import { ipcMain } from 'electron';
import { existsSync, readdirSync, statSync } from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { resolve } from 'path';
import { DIRECTORIES, IPC_CHANNELS } from '../../shared/constants.js';
import { LogLevel, RuntimeResult, RuntimeState, RuntimeStatus } from '../../shared/types.js';
import { pushLog, runtimeSteps, store } from '../store.js';

const ROOT = resolve(DIRECTORIES.ROOT || '.');

// ---------------------------------------------------------------------------
// Recovery configuration  (Platform-only – no OpenClaw source changes)
// ---------------------------------------------------------------------------
const RECOVERY_ENABLED = false;               // V0.2 default: manual recovery
const MAX_RESTART_ATTEMPTS = 3;
const HEALTH_CHECK_INTERVAL_MS = 30_000;     // 30 s
const STARTUP_TIMEOUT_MS = 60_000;            // 60 s grace window after spawn

// ---------------------------------------------------------------------------
// Runtime internal state
// ---------------------------------------------------------------------------
let runtimeProcess: ChildProcess | null = null;
let healthCheckTimer: ReturnType<typeof setInterval> | null = null;
let startupTimer: ReturnType<typeof setTimeout> | null = null;
let restartCount = 0;

// ---------------------------------------------------------------------------
// Logging helper
// ---------------------------------------------------------------------------
function log(line: string, level: LogLevel = LogLevel.INFO): void {
  const tag = '[Runtime]';
  console.log(`${tag} ${line}`);
  pushLog('runtime', line, level);
}

// ---------------------------------------------------------------------------
// Step / status helpers
// ---------------------------------------------------------------------------
function setSteps(index: number, status: RuntimeStatus, message: string): void {
  const recoveryInfo = store.runtime.recoveryInfo;
  store.runtime.status = status;
  store.runtime.message = message;
  store.runtime.steps = runtimeSteps.map((step, stepIndex) => ({
    ...step,
    status: stepIndex < index ? 'done' : stepIndex === index ? 'active' : 'pending',
  }));
  store.runtime.recoveryInfo = recoveryInfo; // preserve across transitions
}

function markAllStepsDone(): void {
  store.runtime.steps = runtimeSteps.map((step) => ({ ...step, status: 'done' }));
}

// ---------------------------------------------------------------------------
// Health checker – probes process liveness without touching OpenClaw code
// ---------------------------------------------------------------------------
function startHealthCheck(): void {
  stopHealthCheck(); // clear any previous timer
  healthCheckTimer = setInterval(() => {
    if (store.runtime.status !== RuntimeStatus.RUNNING) return;
    if (!runtimeProcess) {
      handleUnexpectedExit(null, 'process-gone');
      return;
    }
    // Try sending signal 0 to see if process still exists
    try {
      process.kill(runtimeProcess.pid ?? -1, 0);
      store.runtime.healthCheck = 'healthy';
    } catch {
      // Process no longer alive
      runtimeProcess = null;
      handleUnexpectedExit(null, 'signal-check-failed');
    }
  }, HEALTH_CHECK_INTERVAL_MS);
}

function stopHealthCheck(): void {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
}

// ---------------------------------------------------------------------------
// Unexpected exit handler with auto-recovery framework
// ---------------------------------------------------------------------------
function handleUnexpectedExit(code: number | null, signal: string | null): boolean {
  if (store.runtime.status === RuntimeStatus.STOPPING) return false; // user-initiated

  const reason = signal ?? `code=${code}`;
  log(`进程意外退出: ${reason}`, LogLevel.ERROR);
  store.runtime.healthCheck = 'unhealthy';
  store.runtime.status = RuntimeStatus.ERROR;
  store.runtime.message = `Runtime 异常退出 (${reason})`;
  store.runtime.pid = null;

  // Auto-recovery attempt – returns true when a restart should be triggered
  if (RECOVERY_ENABLED && restartCount < MAX_RESTART_ATTEMPTS) {
    restartCount++;
    const recoveryInfo = { restartCount, maxAttempts: MAX_RESTART_ATTEMPTS, lastError: reason };
    store.runtime.recoveryInfo = recoveryInfo;
    log(`自动恢复: 第 ${restartCount}/${MAX_RESTART_ATTEMPTS} 次尝试重启`, LogLevel.WARN);
    clearStartupTimer();
    return true; // signal caller to trigger restart
  } else if (RECOVERY_ENABLED) {
    log(`自动恢复已达上限 (${MAX_RESTART_ATTEMPTS})，停止重试`, LogLevel.ERROR);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Startup timer – detect hangs during boot sequence
// ---------------------------------------------------------------------------
function setStartupTimer(): void {
  clearStartupTimer();
  startupTimer = setTimeout(() => {
    if (store.runtime.status !== RuntimeStatus.RUNNING) {
      log(`启动超时 (${STARTUP_TIMEOUT_MS / 1000}s)，终止等待`, LogLevel.ERROR);
      store.runtime.status = RuntimeStatus.ERROR;
      store.runtime.message = `启动超时 (${STARTUP_TIMEOUT_MS / 1000}s)`;
      markAllStepsDone(); // mark steps as done so UI doesn't spin forever
    }
  }, STARTUP_TIMEOUT_MS);
}

function clearStartupTimer(): void {
  if (startupTimer) {
    clearTimeout(startupTimer);
    startupTimer = null;
  }
}

// ---------------------------------------------------------------------------
// Public Manager
// ---------------------------------------------------------------------------
export class RuntimeManager {
  register(): void {
    ipcMain.handle(IPC_CHANNELS.RUNTIME_START, async () => {
      log('[Launcher] 收到启动请求');
      return this.start();
    });
    ipcMain.handle(IPC_CHANNELS.RUNTIME_STOP, async () => {
      log('[Launcher] 收到停止请求');
      return this.stop();
    });
    ipcMain.handle(IPC_CHANNELS.RUNTIME_RESTART, async () => {
      log('[Launcher] 收到重启请求');
      return this.restart();
    });
    ipcMain.handle(IPC_CHANNELS.RUNTIME_STATUS, async () => this.status());
  }

  status(): RuntimeState {
    // Live-check: if store says RUNNING but process is actually dead, correct it
    if (store.runtime.status === RuntimeStatus.RUNNING && !runtimeProcess) {
      store.runtime.healthCheck = 'unhealthy';
    }
    return store.runtime;
  }

  async start(): Promise<RuntimeResult> {
    log('[Platform API] 准备启动 Runtime');

    if (store.runtime.status === RuntimeStatus.RUNNING && runtimeProcess) {
      log('[Platform API] Runtime 已在运行中，跳过');
      return { success: true, message: 'Runtime 已在运行', state: store.runtime, recoveryInfo: store.runtime.recoveryInfo };
    }

    // Step 1: Environment Check
    setSteps(0, RuntimeStatus.CHECKING, '[1/5] 环境检测中...');
    log('[Runtime] Step 1/5: 环境检测');

    const requiredDirs = [
      DIRECTORIES.RUNTIME,
      DIRECTORIES.CONFIG,
      DIRECTORIES.WORKSPACE,
    ];
    for (const dir of requiredDirs) {
      const full = resolve(ROOT, dir);
      if (!existsSync(full)) {
        const msg = `[Runtime] 目录不存在: ${dir} (${full})`;
        log(msg, LogLevel.ERROR);
        store.runtime.status = RuntimeStatus.ERROR;
        store.runtime.message = msg;
        return { success: false, message: msg, state: store.runtime };
      }
      log(`[Runtime] 目录正常: ${dir}`);
    }

    // Check Node.js
    const nodePath = resolve(ROOT, DIRECTORIES.RUNTIME, 'node.exe');
    if (!existsSync(nodePath)) {
      const msg = `[Runtime] Node.js 未找到: ${nodePath}`;
      log(msg, LogLevel.ERROR);
      store.runtime.status = RuntimeStatus.ERROR;
      store.runtime.message = msg;
      return { success: false, message: msg, state: store.runtime };
    }
    log(`[Runtime] Node.js 正常: ${nodePath}`);

    // Check OpenClaw source entry
    const openclawDir = resolve(ROOT, 'openclaw');
    const openclawMjs = resolve(openclawDir, 'openclaw.mjs');
    if (!existsSync(openclawMjs)) {
      const msg = `[Runtime] OpenClaw 入口未找到: ${openclawMjs}`;
      log(msg, LogLevel.ERROR);
      store.runtime.status = RuntimeStatus.ERROR;
      store.runtime.message = msg;
      return { success: false, message: msg, state: store.runtime };
    }

    // Step 2: Launch OpenClaw Runtime via Node.js
    setSteps(1, RuntimeStatus.LOADING_RUNTIME, '[2/5] 启动 OpenClaw Runtime 进程...');
    log(`[Runtime] Step 2/5: 执行命令: ${nodePath} ${openclawMjs}`);

    setStartupTimer(); // <-- startup timeout guard

    try {
      runtimeProcess = spawn(nodePath, [openclawMjs, 'gateway', 'run', '--allow-unconfigured', '--force'], {
        cwd: openclawDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
      });

      const pid = runtimeProcess.pid;
      log(`[Runtime] 进程已创建, PID=${pid}`);

      runtimeProcess.stdout?.on('data', (data: Buffer) => {
        const text = data.toString().trim();
        if (text) {
          log(`[Runtime stdout] ${text}`);
        }
      });

      runtimeProcess.stderr?.on('data', (data: Buffer) => {
        const text = data.toString().trim();
        if (text) {
          log(`[Runtime stderr] ${text}`, LogLevel.WARN);
        }
      });

      runtimeProcess.on('error', (err: Error) => {
        const msg = `[Runtime] 进程错误: ${err.message}`;
        log(msg, LogLevel.ERROR);
        store.runtime.status = RuntimeStatus.ERROR;
        store.runtime.message = msg;
        runtimeProcess = null;
      });

      runtimeProcess.on('exit', (code: number | null, signal: string | null) => {
        const msg = `[Runtime] 进程已退出, code=${code}, signal=${signal}`;
        log(msg, code === 0 ? LogLevel.INFO : LogLevel.WARN);

        // Case 1: User-initiated stop is in progress — mark as stopped
        if (store.runtime.status === RuntimeStatus.STOPPING) {
          store.runtime.status = RuntimeStatus.STOPPED;
          store.runtime.message = msg;
          runtimeProcess = null;
          return;
        }

        // Case 2: Process was running and exited normally (code=0)
        if (store.runtime.status === RuntimeStatus.RUNNING && code === 0) {
          store.runtime.status = RuntimeStatus.STOPPED;
          store.runtime.message = msg;
          runtimeProcess = null;
          return;
        }

        // Case 3: Process was running and exited abnormally — trigger recovery framework
        if (store.runtime.status === RuntimeStatus.RUNNING) {
          const shouldRestart = handleUnexpectedExit(code, signal);
          runtimeProcess = null;
          if (shouldRestart) {
            void this.start(); // fire-and-forget auto-recovery
          }
          return;
        }

        // Any other state — just clear the process reference
        runtimeProcess = null;
      });

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const msg = `[Runtime] 启动失败: ${errMsg}`;
      log(msg, LogLevel.ERROR);
      store.runtime.status = RuntimeStatus.ERROR;
      store.runtime.message = msg;
      clearStartupTimer();
      return { success: false, message: msg, state: store.runtime };
    }

    // Step 3: Scan plugins
    setSteps(2, RuntimeStatus.LOADING_PLUGINS, '[3/5] 扫描插件目录...');
    log('[Runtime] Step 3/5: 扫描插件');
    const pluginDir = resolve(ROOT, DIRECTORIES.PLUGINS);
    if (existsSync(pluginDir)) {
      const entries = readdirSync(pluginDir).filter((e) => {
        const full = resolve(pluginDir, e);
        return statSync(full).isDirectory();
      });
      log(`[Runtime] 发现 ${entries.length} 个插件目录: ${entries.join(', ') || '无'}`);
    }

    // Step 4: Scan workspace
    setSteps(3, RuntimeStatus.LOADING_WORKSPACE, '[4/5] 读取工作区...');
    log('[Runtime] Step 4/5: 读取工作区');
    const wsDir = resolve(ROOT, DIRECTORIES.WORKSPACE);
    if (existsSync(wsDir)) {
      const wsEntries = readdirSync(wsDir).filter((e) => {
        const full = resolve(wsDir, e);
        return statSync(full).isDirectory();
      });
      log(`[Runtime] 发现 ${wsEntries.length} 个工作区`);
    }

    // Step 5: Agents
    setSteps(4, RuntimeStatus.LOADING_AGENTS, `[5/5] 装载 ${store.agents.length} 个 Agent...`);
    log(`[Runtime] Step 5/5: ${store.agents.length} 个 Agent 定义`);

    const recoveryInfo = store.runtime.recoveryInfo;
    if (recoveryInfo && recoveryInfo.restartCount > 0) {
      restartCount = recoveryInfo.restartCount;
    }

    store.runtime = {
      status: RuntimeStatus.RUNNING,
      pid: runtimeProcess?.pid ?? null,
      startedAt: new Date().toISOString(),
      message: `OpenClaw Runtime 已启动 (PID=${runtimeProcess?.pid})`,
      steps: runtimeSteps.map((step) => ({ ...step, status: 'done' })),
      healthCheck: 'healthy',
      recoveryInfo,
    };

    clearStartupTimer();
    startHealthCheck(); // <-- periodic liveness probe

    log(`[Runtime] 启动成功, PID=${runtimeProcess?.pid}`);
    return { success: true, message: store.runtime.message, state: store.runtime, recoveryInfo };
  }

  async stop(): Promise<RuntimeResult> {
    log('[Platform API] 停止 Runtime');
    store.runtime.status = RuntimeStatus.STOPPING;
    store.runtime.message = '正在停止 Runtime...';

    clearStartupTimer();
    stopHealthCheck();

    if (runtimeProcess) {
      const pid = runtimeProcess.pid;
      log(`[Runtime] 正在终止进程 PID=${pid}`);
      try {
        runtimeProcess.kill('SIGTERM');
      } catch {
        // process may have already exited
      }
      setTimeout(() => {
        if (runtimeProcess) {
          log(`[Runtime] 进程未响应 SIGTERM，强制终止 PID=${pid}`, LogLevel.WARN);
          try {
            runtimeProcess.kill('SIGKILL');
          } catch {
            // already dead
          }
        }
      }, 5000);
      runtimeProcess = null;
      log(`[Runtime] 进程已终止信号已发送 PID=${pid}`);
    } else {
      log('[Runtime] 无运行中的进程');
    }

    restartCount = 0; // reset recovery counter on clean stop

    store.runtime = {
      status: RuntimeStatus.STOPPED,
      pid: null,
      startedAt: null,
      message: 'Runtime 已停止',
      steps: runtimeSteps.map((step) => ({ ...step, status: 'pending' })),
      healthCheck: 'unhealthy',
      recoveryInfo: undefined,
    };
    log('[Runtime] 停止完成');
    return { success: true, message: 'Runtime 已停止', state: store.runtime };
  }

  async restart(): Promise<RuntimeResult> {
    log('[Platform API] 重启 Runtime');
    await this.stop();
    return this.start();
  }
}
