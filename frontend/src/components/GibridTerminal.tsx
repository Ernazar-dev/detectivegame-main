import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import api from "../lib/api";
import { Task, TerminalExecuteResult, TerminalCommand } from "../lib/types";

export type EvidenceItem = {
  id: string;
  evidenceId?: number;
  file: string;
  source: string;
  title: string;
  body: string;
  timestamp: string;
  mediaUrl?: string;
  mediaType?: string;
  relevance?: string;
  isKeyEvidence?: boolean;
  sent?: boolean;
  studentTag?: string | null;
  studentNote?: string;
  linkedSuspectId?: number | null;
};

type Mode = "game" | "root" | "root-fallback";

const G = "\x1b[01;32m";
const B = "\x1b[01;34m";
const R = "\x1b[01;31m";
const Y = "\x1b[01;33m";
const DM = "\x1b[90m";
const X = "\x1b[00m";
const C = "\x1b[01;36m";

const GAME_PROMPT = `${G}┌──(${G}detective${X}㉿${B}kali${G})-[${B}~/investigation${G}]${X}\r\n${G}└─${G}$${X} `;

const ROOT_PROMPT = `${R}┌──(${R}root${X}㉿${B}kali${R})-[${R}~${R}]${X}\r\n${R}└─${R}#${X} `;

const KALI_THEME_GAME = {
  background: "#1c1c1c",
  foreground: "#eeeeec",
  cursor: "#eeeeec",
  cursorAccent: "#1c1c1c",
  selectionBackground: "rgba(238,238,236,0.22)",
  black: "#2e2e2e",
  red: "#cc0000",
  green: "#4e9a06",
  yellow: "#c4a000",
  blue: "#3465a4",
  magenta: "#75507b",
  cyan: "#06989a",
  white: "#d3d7cf",
  brightBlack: "#555753",
  brightRed: "#ef2929",
  brightGreen: "#8ae234",
  brightYellow: "#fce94f",
  brightBlue: "#729fcf",
  brightMagenta: "#ad7fa8",
  brightCyan: "#34e2e2",
  brightWhite: "#eeeeec",
};

const KALI_THEME_ROOT = {
  background: "#0d0d0d",
  foreground: "#d4d4d4",
  cursor: "#ff3333",
  cursorAccent: "#0d0d0d",
  selectionBackground: "rgba(255,51,51,0.25)",
  black: "#1a1a1a",
  red: "#ff3333",
  green: "#50fa7b",
  yellow: "#f1fa8c",
  blue: "#6272a4",
  magenta: "#ff79c6",
  cyan: "#8be9fd",
  white: "#f8f8f2",
  brightBlack: "#44475a",
  brightRed: "#ff5555",
  brightGreen: "#69ff94",
  brightYellow: "#ffffa5",
  brightBlue: "#d6acff",
  brightMagenta: "#ff92df",
  brightCyan: "#a4ffff",
  brightWhite: "#ffffff",
};

const ROOT_TRIGGERS = new Set([
  "sudo su",
  "sudo su -",
  "sudo -i",
  "sudo -s",
  "sudo bash",
  "su",
  "su -",
  "su root",
]);

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function buildWsUrl() {
  const token = localStorage.getItem("auth_token") || "";
  const apiUrl = (import.meta.env.VITE_API_URL as string) || "";
  if (apiUrl)
    return apiUrl.replace(/^http/, "ws") + "/api/ws/pty?token=" + token;
  const p = location.protocol === "https:" ? "wss:" : "ws:";
  return `${p}//${location.host}/api/ws/pty?token=${token}`;
}

const FALLBACK_COMMANDS: Record<string, () => string> = {
  ifconfig: () =>
    `eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500\r\n` +
    `        inet ${C}192.168.1.${Math.floor(Math.random() * 200 + 10)}${X}  netmask 255.255.255.0  broadcast 192.168.1.255\r\n` +
    `        inet6 fe80::a00:27ff:fe4e:66a1  prefixlen 64  scopeid 0x20<link>\r\n` +
    `        ether 08:00:27:4e:66:a1  txqueuelen 1000  (Ethernet)\r\n` +
    `        RX packets 12483  bytes 18234512 (17.3 MiB)\r\n` +
    `        TX packets 8921  bytes 1293847 (1.2 MiB)\r\n\r\n` +
    `lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536\r\n` +
    `        inet ${C}127.0.0.1${X}  netmask 255.0.0.0\r\n` +
    `        inet6 ::1  prefixlen 128  scopeid 0x10<host>\r\n` +
    `        loop  txqueuelen 1000  (Local Loopback)\r\n`,

  "ip a": () =>
    `1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN\r\n` +
    `    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00\r\n` +
    `    inet ${C}127.0.0.1/8${X} scope host lo\r\n` +
    `2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP\r\n` +
    `    link/ether 08:00:27:4e:66:a1 brd ff:ff:ff:ff:ff:ff\r\n` +
    `    inet ${C}192.168.1.${Math.floor(Math.random() * 200 + 10)}/24${X} brd 192.168.1.255 scope global eth0\r\n`,

  "ip addr": () => FALLBACK_COMMANDS["ip a"](),
  whoami: () => `${R}root${X}\r\n`,
  id: () =>
    `${R}uid=0(root)${X} ${Y}gid=0(root)${X} ${G}groups=0(root)${X}\r\n`,
  "uname -a": () =>
    `Linux kali 6.8.0-kali3-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.8.12-1kali1 (2024-05-10) x86_64 GNU/Linux\r\n`,
  uname: () => `Linux\r\n`,
  hostname: () => `kali\r\n`,
  pwd: () => `${B}/root${X}\r\n`,
  ls: () =>
    `${B}Desktop${X}  ${B}Documents${X}  ${B}Downloads${X}  ${B}Music${X}  ${B}Pictures${X}  ${B}Public${X}  ${B}Templates${X}  ${B}Videos${X}\r\n`,
  "ls -la": () =>
    `total 48\r\n` +
    `drwx------ 1 root root 4096 May  2 09:14 ${B}.${X}\r\n` +
    `drwxr-xr-x 1 root root 4096 May  2 09:14 ${B}..${X}\r\n` +
    `-rw------- 1 root root  512 May  2 09:14 .bash_history\r\n` +
    `-rw-r--r-- 1 root root 3526 Jan  5  2024 .bashrc\r\n` +
    `drwxr-xr-x 2 root root 4096 Jan  5  2024 ${B}Desktop${X}\r\n` +
    `drwxr-xr-x 2 root root 4096 Jan  5  2024 ${B}Documents${X}\r\n` +
    `drwxr-xr-x 2 root root 4096 Jan  5  2024 ${B}Downloads${X}\r\n`,
  "ls -l": () => FALLBACK_COMMANDS["ls -la"](),
  "ls -a": () =>
    `${DM}.${X}  ${DM}..${X}  ${DM}.bash_history${X}  ${DM}.bashrc${X}  ${DM}.profile${X}  ` +
    `${B}Desktop${X}  ${B}Documents${X}  ${B}Downloads${X}  ${B}Music${X}  ${B}Pictures${X}\r\n`,
  "cat /etc/os-release": () =>
    `PRETTY_NAME="${G}Kali GNU/Linux Rolling${X}"\r\n` +
    `NAME="Kali GNU/Linux"\r\nVERSION_ID="2024.2"\r\nVERSION="2024.2"\r\n` +
    `ID=kali\r\nID_LIKE=debian\r\nHOME_URL="https://www.kali.org/"\r\n`,
  "cat /etc/hostname": () => `kali\r\n`,
  "cat /etc/passwd": () =>
    `root:x:0:0:root:/root:/bin/bash\r\n` +
    `daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\r\n` +
    `nobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin\r\n` +
    `kali:x:1000:1000:Kali,,,:/home/kali:/bin/bash\r\n`,
  "ps aux": () =>
    `${G}USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND${X}\r\n` +
    `root           1  0.0  0.1  21568  5120 ?        Ss   09:00   0:01 /sbin/init\r\n` +
    `root         423  0.0  0.2  14336  8192 ?        Ss   09:00   0:00 /lib/systemd/systemd-journald\r\n` +
    `root         891  0.0  0.1  12288  4096 ?        Ss   09:00   0:00 sshd: /usr/sbin/sshd\r\n` +
    `root        1024  0.1  0.3  18432  9216 pts/0    Ss   09:14   0:00 bash\r\n`,
  ps: () =>
    `${G}  PID TTY          TIME CMD${X}\r\n` +
    `  1024 pts/0    00:00:00 bash\r\n` +
    `  1891 pts/0    00:00:00 ps\r\n`,
  "netstat -an": () =>
    `Active Internet connections (servers and established)\r\n` +
    `${G}Proto Recv-Q Send-Q Local Address           Foreign Address         State${X}\r\n` +
    `tcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN\r\n` +
    `tcp        0      0 0.0.0.0:80              0.0.0.0:*               LISTEN\r\n` +
    `tcp        0      0 127.0.0.1:3306          0.0.0.0:*               LISTEN\r\n` +
    `tcp6       0      0 :::22                   :::*                    LISTEN\r\n`,
  "netstat -tulnp": () => FALLBACK_COMMANDS["netstat -an"](),
  "netstat -rn": () =>
    `${G}Kernel IP routing table${X}\r\n` +
    `Destination     Gateway         Genmask         Flags   MSS Window  irtt Iface\r\n` +
    `0.0.0.0         192.168.1.1     0.0.0.0         UG        0 0          0 eth0\r\n` +
    `192.168.1.0     0.0.0.0         255.255.255.0   U         0 0          0 eth0\r\n`,
  "ss -tulnp": () =>
    `${G}Netid  State   Recv-Q  Send-Q  Local Address:Port  Peer Address:Port${X}\r\n` +
    `tcp    LISTEN  0       128     0.0.0.0:22             0.0.0.0:*\r\n` +
    `tcp    LISTEN  0       128     0.0.0.0:80             0.0.0.0:*\r\n`,
  history: () =>
    `    1  ifconfig\r\n    2  ip a\r\n    3  nmap -sV 192.168.1.1\r\n` +
    `    4  netstat -an\r\n    5  ps aux\r\n    6  whoami\r\n    7  id\r\n` +
    `    8  uname -a\r\n    9  cat /etc/os-release\r\n   10  sudo su\r\n`,
  date: () =>
    `${new Date()
      .toString()
      .replace(/\(.+\)/, "")
      .trim()}\r\n`,
  uptime: () => {
    const h = Math.floor(Math.random() * 10 + 1);
    const m = Math.floor(Math.random() * 59);
    return ` ${new Date().toLocaleTimeString()} up ${h}:${String(m).padStart(2, "0")},  1 user,  load average: 0.${Math.floor(Math.random() * 9)}, 0.${Math.floor(Math.random() * 9)}, 0.${Math.floor(Math.random() * 9)}\r\n`;
  },
  "df -h": () =>
    `${G}Filesystem      Size  Used Avail Use% Mounted on${X}\r\n` +
    `overlay         100G   18G   77G  19% /\r\n` +
    `tmpfs            64M     0   64M   0% /dev\r\n` +
    `tmpfs           1.9G  8.0K  1.9G   1% /run\r\n` +
    `/dev/sda1       100G   18G   77G  19% /etc/hosts\r\n`,
  "free -h": () =>
    `${G}               total        used        free      shared  buff/cache   available${X}\r\n` +
    `Mem:           3.8Gi       1.2Gi       1.4Gi        52Mi       1.2Gi       2.3Gi\r\n` +
    `Swap:          2.0Gi          0B       2.0Gi\r\n`,
  env: () =>
    `SHELL=/bin/bash\r\nPWD=/root\r\nLOGNAME=root\r\n` +
    `HOME=/root\r\nTERM=xterm-256color\r\nUSER=root\r\n` +
    `PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\r\nLANG=en_US.UTF-8\r\n`,
  "cat /proc/version": () =>
    `Linux version 6.8.0-kali3-amd64 (devel@kali.org) (gcc-13 (Debian 13.2.0-25) 13.2.0, GNU ld (GNU Binutils for Debian) 2.42) #1 SMP PREEMPT_DYNAMIC Debian 6.8.12-1kali1\r\n`,
  "cat /proc/cpuinfo": () =>
    `processor\t: 0\r\nvendor_id\t: GenuineIntel\r\nmodel name\t: Intel(R) Core(TM) i7-9750H CPU @ 2.60GHz\r\n` +
    `cpu MHz\t\t: 2600.000\r\ncache size\t: 12288 KB\r\ncpu cores\t: 6\r\n`,
  "which bash": () => `/bin/bash\r\n`,
  "which python3": () => `/usr/bin/python3\r\n`,
  "which nmap": () => `/usr/bin/nmap\r\n`,
  "which curl": () => `/usr/bin/curl\r\n`,
  "which wget": () => `/usr/bin/wget\r\n`,
  w: () =>
    `${G} ${new Date().toLocaleTimeString()}  up  3:14,  1 user,  load average: 0.1, 0.2, 0.1${X}\r\n` +
    `${G}USER     TTY      FROM             LOGIN@   IDLE JCPU   PCPU WHAT${X}\r\n` +
    `root     pts/0    192.168.1.50     09:14    0.00s  0.08s  0.00s w\r\n`,
  last: () =>
    `root     pts/0        192.168.1.50     Thu May  2 09:14   still logged in\r\n` +
    `root     pts/0        192.168.1.50     Wed May  1 22:45 - 23:12  (00:27)\r\n` +
    `\r\nwtmp begins Wed May  1 22:45:00 2024\r\n`,
  "lsb_release -a": () =>
    `No LSB modules are available.\r\n` +
    `Distributor ID:\tKali\r\nDescription:\tKali GNU/Linux Rolling\r\n` +
    `Release:\t2024.2\r\nCodename:\tkali-rolling\r\n`,
  "ip route": () =>
    `default via 192.168.1.1 dev eth0 proto dhcp src 192.168.1.105 metric 100\r\n` +
    `192.168.1.0/24 dev eth0 proto kernel scope link src 192.168.1.105\r\n`,
  "arp -a": () =>
    `? (192.168.1.1) at aa:bb:cc:dd:ee:ff [ether] on eth0\r\n` +
    `? (192.168.1.50) at 11:22:33:44:55:66 [ether] on eth0\r\n`,
};

function runFallback(input: string): string | null {
  const t = input.trim().toLowerCase();
  if (t === "") return "";

  for (const [key, fn] of Object.entries(FALLBACK_COMMANDS)) {
    if (t === key.toLowerCase()) return fn();
  }

  if (t.startsWith("ping ")) {
    const parts = input.trim().split(/\s+/);
    const host = parts[parts.length - 1] || "8.8.8.8";
    const ip =
      host === "localhost"
        ? "127.0.0.1"
        : host === "kali"
          ? "127.0.1.1"
          : "8.8.8.8";
    return (
      `PING ${host} (${ip}): 56 data bytes\r\n` +
      `64 bytes from ${ip}: icmp_seq=0 ttl=64 time=1.2 ms\r\n` +
      `64 bytes from ${ip}: icmp_seq=1 ttl=64 time=0.9 ms\r\n` +
      `64 bytes from ${ip}: icmp_seq=2 ttl=64 time=1.1 ms\r\n` +
      `--- ${host} ping statistics ---\r\n` +
      `3 packets transmitted, 3 packets received, 0% packet loss\r\n`
    );
  }

  if (t.startsWith("nmap ")) {
    const host = input.trim().split(/\s+/).pop() || "192.168.1.1";
    return (
      `Starting Nmap 7.94 ( https://nmap.org )\r\n` +
      `Nmap scan report for ${host}\r\n` +
      `Host is up (0.0012s latency).\r\n` +
      `${G}PORT     STATE SERVICE VERSION${X}\r\n` +
      `22/tcp   open  ssh     OpenSSH 9.3p1\r\n` +
      `80/tcp   open  http    Apache httpd 2.4.57\r\n` +
      `443/tcp  open  https   Apache httpd 2.4.57\r\n` +
      `3306/tcp open  mysql   MySQL 8.0.36\r\n` +
      `Nmap done: 1 IP address (1 host up) scanned in 2.14 seconds\r\n`
    );
  }

  if (t.startsWith("echo ")) return input.trim().slice(5) + "\r\n";

  if (t.startsWith("cat ")) {
    const file = input.trim().slice(4).trim();
    return `${R}cat: ${file}: No such file or directory${X}\r\n`;
  }

  if (t.startsWith("ls ")) {
    return `${B}Desktop${X}  ${B}Documents${X}  ${B}Downloads${X}  ${B}Music${X}  ${B}Pictures${X}\r\n`;
  }

  if (t.startsWith("cd")) return "";
  if (t.startsWith("mkdir ")) return "";
  if (t.startsWith("touch ")) return "";
  if (t.startsWith("chmod ") || t.startsWith("chown ")) return "";

  if (t === "python3" || t === "python") {
    return `${G}Python 3.11.9 (main, Apr 2 2024, 08:25:04) [GCC 13.2.0] on linux${X}\r\nType "help", "copyright", "credits" or "license" for more information.\r\n>>> `;
  }

  if (t.startsWith("curl ")) {
    const url = input.trim().split(/\s+/).pop() || "";
    return `${R}curl: (6) Could not resolve host: ${url.replace(/^https?:\/\//, "").split("/")[0]}${X}\r\n`;
  }

  if (t.startsWith("wget "))
    return `${R}wget: unable to resolve host address${X}\r\n`;

  if (t.startsWith("man ")) {
    const cmd = input.trim().slice(4).trim();
    return `${G}${cmd}(1)${X} - manual page\r\nNo manual entry for ${cmd}\r\n`;
  }

  if (t === "clear" || t === "cls") return "__CLEAR__";
  if (t === "exit" || t === "logout") return "__EXIT__";

  return null;
}

function writeBanner(term: Terminal, caseTitle: string) {
  const t = caseTitle.length > 50 ? caseTitle.slice(0, 47) + "..." : caseTitle;
  const pad = (s: string, n: number) =>
    s + " ".repeat(Math.max(0, n - s.length));
  term.write(
    `\r\n${G}  ██╗  ██╗ █████╗ ██╗     ██╗${X}\r\n` +
      `${G}  ██║ ██╔╝██╔══██╗██║     ██║${X}\r\n` +
      `${G}  █████╔╝ ███████║██║     ██║${X}\r\n` +
      `${G}  ██╔═██╗ ██╔══██║██║     ██║${X}\r\n` +
      `${G}  ██║  ██╗██║  ██║███████╗██║${X}\r\n` +
      `${G}  ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝${X}\r\n\r\n` +
      `${DM}  Linux kali 6.8.0-kali3-amd64 #1 SMP PREEMPT_DYNAMIC${X}\r\n` +
      `${DM}  Last login: ${new Date().toUTCString()}${X}\r\n\r\n` +
      `  ${G}┌──────────────────────────────────────────────────────┐${X}\r\n` +
      `  ${G}│${X}  ${Y}CASE:${X}  ${pad(t, 48)}${G}│${X}\r\n` +
      `  ${G}│${X}  ${Y}MODE:${X}  Investigation Terminal  [CLASSIFIED]     ${G}│${X}\r\n` +
      `  ${G}└──────────────────────────────────────────────────────┘${X}\r\n\r\n` +
      `  Type ${G}help${X} for game commands.  Type ${R}sudo su${X} for root shell.\r\n\r\n`,
  );
}

function writeRootBanner(term: Terminal) {
  term.write(
    `\r\n${R}  ██████╗  ██████╗  ██████╗ ████████╗${X}\r\n` +
      `${R}  ██╔══██╗██╔═══██╗██╔═══██╗╚══██╔══╝${X}\r\n` +
      `${R}  ██████╔╝██║   ██║██║   ██║   ██║   ${X}\r\n` +
      `${R}  ██╔══██╗██║   ██║██║   ██║   ██║   ${X}\r\n` +
      `${R}  ██║  ██║╚██████╔╝╚██████╔╝   ██║   ${X}\r\n` +
      `${R}  ╚═╝  ╚═╝ ╚═════╝  ╚═════╝    ╚═╝   ${X}\r\n\r\n` +
      `${DM}  Kali GNU/Linux Rolling | kernel 6.8.0-kali3-amd64${X}\r\n` +
      `${DM}  Last login: ${new Date().toUTCString()} from 192.168.1.1${X}\r\n\r\n` +
      `  ${R}╔══════════════════════════════════════════════════════╗${X}\r\n` +
      `  ${R}║${X}  ${R}⚠  ROOT SHELL ACTIVE — ALL PROTOCOLS DISABLED  ⚠${X}  ${R}║${X}\r\n` +
      `  ${R}╚══════════════════════════════════════════════════════╝${X}\r\n\r\n`,
  );
}

type Props = {
  task: Task;
  open: boolean;
  onClose: () => void;
  collected: EvidenceItem[];
  setCollected: React.Dispatch<React.SetStateAction<EvidenceItem[]>>;
  activeSuspectId?: number | null;
  /** Called once when the player submits their terminal conclusion note */
  onTerminalComplete?: (note: string) => void;
};

export default function GibridTerminal({
  task,
  open,
  onClose,
  activeSuspectId,
  onTerminalComplete,
}: Props) {
  const storageKey = `det_prog_${task.id}_${activeSuspectId ?? 0}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // FIX #1: Track root onData disposable to prevent listener accumulation.
  // Every switchToRoot call previously added a new term.onData handler without
  // disposing the previous one, causing multiple handlers to fire simultaneously.
  const rootOnDataDisposableRef = useRef<{ dispose: () => void } | null>(null);

  const modeRef = useRef<Mode>("game");
  const inputRef = useRef("");
  const cmdHistRef = useRef<string[]>([]);
  const histIdxRef = useRef(-1);
  const sessionRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const pendingCmdRef = useRef<string | null>(null);

  const [mode, setMode] = useState<Mode>("game");
  const [isMax, setIsMax] = useState(false);

  const completedIdsRef = useRef<Set<number>>(new Set());
  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set());

  const markCompleted = useCallback(
    (cmdId: number) => {
      if (completedIdsRef.current.has(cmdId)) return;
      const next = new Set(completedIdsRef.current);
      next.add(cmdId);
      completedIdsRef.current = next;
      setCompletedIds(new Set(next));
      localStorage.setItem(storageKey, JSON.stringify([...next]));
    },
    [storageKey],
  );

  const completedSteps = completedIds.size;

  const { data: taskCmds } = useQuery<TerminalCommand[]>({
    queryKey: ["tc-player", task.id],
    queryFn: async () =>
      (await api.get(`/tasks/${task.id}/terminal-commands`)).data,
    enabled: open,
    staleTime: 30_000,
  });

  const sortedCmds: TerminalCommand[] = useMemo(
    () => (taskCmds ? [...taskCmds].sort((a, b) => a.order - b.order) : []),
    [taskCmds],
  );

  // Trap commands match player input and show (misleading) output, but they
  // are invisible in the hint panel and do NOT count toward progress.
  // Real commands are everything else — these define the required sequence.
  const realCmds = useMemo(
    () => sortedCmds.filter((c) => !(c as any).isTrap),
    [sortedCmds],
  );
  const totalSteps = realCmds.length;

  // Always expose latest lists to processCmd closure without re-creating it
  const sortedCmdsRef = useRef<TerminalCommand[]>(sortedCmds);
  const realCmdsRef = useRef<TerminalCommand[]>(realCmds);
  useEffect(() => {
    sortedCmdsRef.current = sortedCmds;
  }, [sortedCmds]);
  useEffect(() => {
    realCmdsRef.current = realCmds;
  }, [realCmds]);

  // Shuffle only the real (non-trap) commands for the hint panel.
  // Trap commands are never shown to the player.
  const shuffledCmds = useMemo<TerminalCommand[]>(() => {
    if (realCmds.length === 0) return [];
    const arr = [...realCmds];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [realCmds]);

  const displayCmds = shuffledCmds.map((cmd) => ({
    ...cmd,
    _done: completedIds.has(cmd.id),
  }));

  // Reset progress and conclusion state each time the terminal is freshly opened
  useEffect(() => {
    if (open) {
      const saved = localStorage.getItem(storageKey);
      const ids: number[] = saved ? (JSON.parse(saved) as number[]) : [];
      const set = new Set<number>(ids);
      completedIdsRef.current = set;
      setCompletedIds(new Set(set));
    }
  }, [open, storageKey]);

  const handleDataRef = useRef<(d: string) => void>(() => {});

  const showPrompt = useCallback(() => {
    const term = termRef.current;
    const m = modeRef.current;
    // If the cursor is not at column 0 (output didn't end with \r\n),
    // move to a fresh line so the two-line Kali prompt never wraps mid-line.
    if (term && term.buffer.active.cursorX !== 0) term.write("\r\n");
    if (m === "game") term?.write(GAME_PROMPT);
    else if (m === "root-fallback") term?.write(ROOT_PROMPT);
  }, []);

  const switchToRootFallback = useCallback(async () => {
    const term = termRef.current;
    if (!term) return;
    writeRootBanner(term);
    await sleep(200);
    term.options.theme = KALI_THEME_ROOT;
    term.options.fontWeight = "bold";
    modeRef.current = "root-fallback";
    setMode("root-fallback");
    term.write(ROOT_PROMPT);
  }, []);

  const switchToRoot = useCallback(async () => {
    const term = termRef.current;
    if (!term) return;
    term.write(`\r\n${Y}[sudo] password for detective: ${X}`);
    await sleep(600);
    term.write(`\r\n${G}[+] Authentication successful.${X}\r\n`);
    await sleep(300);
    await switchToRootFallback(); // <-- doim simulyatsiya
  }, [switchToRootFallback]);

  const processRootFallbackCmd = useCallback(
    async (cmd: string) => {
      const term = termRef.current;
      if (!term) return;
      const t = cmd.trim();

      if (t) {
        cmdHistRef.current.push(t);
        histIdxRef.current = -1;
      }

      term.write("\r\n");
      if (!t) {
        showPrompt();
        return;
      }

      if (t === "exit" || t === "logout") {
        term.write(`${DM}exit${X}\r\n\r\n`);
        term.options.theme = KALI_THEME_GAME;
        term.options.fontWeight = "normal";
        modeRef.current = "game";
        setMode("game");
        showPrompt();
        return;
      }

      // API orqali o'qituvchi buyruqlarini tekshirish
      if (sessionRef.current !== null) {
        try {
          const payload = { command: t, suspectId: activeSuspectId ?? null };
          const r = await api.post<TerminalExecuteResult>(
            `/sessions/${sessionRef.current}/terminal-execute`,
            payload,
          );
          const d = r.data;
          if (d.matched) {
            const cmdId =
              (d as any).matchedCommandId ??
              findMatchedCmdId(t, sortedCmdsRef.current);
            const matchedCmd =
              cmdId !== undefined
                ? sortedCmdsRef.current.find((c) => c.id === cmdId)
                : undefined;

            if (matchedCmd && (matchedCmd as any).isTrap) {
              term.write((d.output || "").replace(/(?<!\r)\n/g, "\r\n"));
            } else {
              const nextExpected = realCmdsRef.current.find(
                (c) => !completedIdsRef.current.has(c.id),
              );
              const isInOrder =
                !nextExpected ||
                (matchedCmd && matchedCmd.id === nextExpected.id);
              if (isInOrder) {
                term.write((d.output || "").replace(/(?<!\r)\n/g, "\r\n"));
                if (cmdId !== undefined) markCompleted(cmdId);
                const newCount = completedIdsRef.current.size;
                const total = realCmdsRef.current.length;
                if (d.isFinalStep || (total > 0 && newCount >= total)) {
                  term.write(
                    `\r\n${G}[✔] Investigation complete for this suspect!${X}\r\n`,
                  );
                  if (onTerminalComplete) {
                    onTerminalComplete(
                      (d.output || "")
                        .replace(/\r\n/g, "\n")
                        .replace(/\r/g, "\n")
                        .trim(),
                    );
                  }
                }
              } else {
                term.write(
                  `${Y}[!] Boshqa buyruqni tekshirib ko'ring.${X}\r\n`,
                );
              }
            }
            showPrompt();
            return;
          }
        } catch {
          // API xatosi — Linux fallbackga o'tamiz
        }
      }

      // Linux buyruq simulyatsiyasi
      const result = runFallback(t);
      if (result === "__CLEAR__") {
        term.clear();
        showPrompt();
        return;
      }
      if (result === "__EXIT__") {
        term.write(`${DM}exit${X}\r\n\r\n`);
        term.options.theme = KALI_THEME_GAME;
        term.options.fontWeight = "normal";
        modeRef.current = "game";
        setMode("game");
        showPrompt();
        return;
      }
      if (result === "") {
        showPrompt();
        return;
      }
      if (result !== null) {
        term.write(result);
      } else {
        term.write(`${R}bash: ${t}: command not found${X}\r\n`);
      }
      showPrompt();
    },
    [showPrompt, activeSuspectId, markCompleted, onTerminalComplete],
  );

  const processCmd = useCallback(
    async (cmd: string) => {
      const term = termRef.current;
      if (!term) return;
      const t = cmd.trim();

      if (!t) {
        term.write("\r\n");
        showPrompt();
        return;
      }

      cmdHistRef.current.push(t);
      histIdxRef.current = -1;

      if (t === "clear" || t === "cls") {
        term.clear();
        showPrompt();
        return;
      }
      if (t === "exit" || t === "logout") {
        term.write(`\r\n${DM}logout${X}\r\n`);
        setTimeout(onClose, 300);
        return;
      }
      if (ROOT_TRIGGERS.has(t)) {
        await switchToRoot();
        return;
      }

      if (t === "help") {
        term.write(
          `\r\n${G}Available commands:${X}\r\n` +
            `  ${C}help${X}           — show this help\r\n` +
            `  ${C}clear${X}          — clear terminal\r\n` +
            `  ${C}sudo su${X}        — switch to root shell\r\n` +
            `  ${C}exit${X}           — close terminal\r\n` +
            `  ${DM}[linux cmd]${X}    — ls, whoami, ifconfig, ip a, ps, nmap, ping ...\r\n` +
            `  ${DM}[game cmd]${X}     — investigate suspects\r\n\r\n`,
        );
        showPrompt();
        return;
      }

      term.write("\r\n");
      busyRef.current = true;

      // Wait for session to be initialised (created asynchronously on mount)
      if (sessionRef.current == null) {
        term.write(`${DM}[...] Initializing session...${X}\r\n`);
        let waited = 0;
        while (sessionRef.current == null && waited < 3000) {
          await sleep(100);
          waited += 100;
        }
        if (sessionRef.current == null) {
          // Session never arrived — try local fallback instead of hard error
          const fb = runFallback(t);
          if (fb !== null && fb !== "__EXIT__") {
            if (fb === "__CLEAR__") {
              term.clear();
            } else if (fb !== "") {
              term.write(fb.replace(/(?<!\r)\n/g, "\r\n"));
            }
          } else {
            term.write(`${R}bash: session not ready — try again${X}\r\n`);
          }
          busyRef.current = false;
          showPrompt();
          return;
        }
      }

      try {
        const payload: { command: string; suspectId: number | null } = {
          command: t,
          suspectId: activeSuspectId ?? null,
        };
        const r = await api.post<TerminalExecuteResult>(
          `/sessions/${sessionRef.current}/terminal-execute`,
          payload,
        );
        const d = r.data;

        if (d.matched) {
          // Prefer server-supplied matchedCommandId; fall back to client-side detection.
          // Search the full sortedCmds (including traps) so trap commands are found too.
          const cmdId =
            (d as any).matchedCommandId ??
            findMatchedCmdId(t, sortedCmdsRef.current);
          const matchedCmd =
            cmdId !== undefined
              ? sortedCmdsRef.current.find((c) => c.id === cmdId)
              : undefined;

          // ── Trap command ──────────────────────────────────────────────────────
          // A trap command is intentionally misleading: it matches the player's
          // input, shows fake/wrong output, but does NOT advance the progress bar
          // and is completely invisible in the hint panel.
          if (matchedCmd && (matchedCmd as any).isTrap) {
            term.write((d.output || "").replace(/(?<!\r)\n/g, "\r\n"));
            // No markCompleted — progress stays still
          } else {
            // ── Sequential order enforcement ───────────────────────────────────
            // Among real (non-trap) commands, the player must complete them in the
            // order defined by the admin. nextExpected is the first real command
            // that has not yet been marked completed.
            const nextExpected = realCmdsRef.current.find(
              (c) => !completedIdsRef.current.has(c.id),
            );

            // In order when: no real commands exist (free-form), OR matched cmd
            // is exactly the next expected one.
            const isInOrder =
              !nextExpected ||
              (matchedCmd && matchedCmd.id === nextExpected.id);

            if (isInOrder) {
              // ✅ Correct command, correct order → advance
              term.write((d.output || "").replace(/(?<!\r)\n/g, "\r\n"));

              if (cmdId !== undefined) markCompleted(cmdId);

              const newCount = completedIdsRef.current.size;
              const total = realCmdsRef.current.length;

              if (d.isFinalStep || (total > 0 && newCount >= total)) {
                term.write(
                  `\r\n${G}[✔] Investigation complete for this suspect!${X}\r\n`,
                );
                // Auto-capture last command output for teacher report
                if (onTerminalComplete) {
                  onTerminalComplete(
                    (d.output || "")
                      .replace(/\r\n/g, "\n")
                      .replace(/\r/g, "\n")
                      .trim(),
                  );
                }
              }
            } else {
              // ⚠️ Correct command but wrong order → soft hint, no spoilers
              term.write(`${Y}[!] Boshqa buyruqni tekshirib ko'ring.${X}\r\n`);
            }
          }
        } else {
          // FIX #6: Previously this branch checked activeSuspectId to decide
          // whether to show the server output or fall back to Linux commands.
          // This silently dropped the server response for task-level commands
          // (where activeSuspectId is null) and always ran Linux fallback.
          // Correct logic: show server output when the API returned a non-empty
          // output regardless of suspectId; only run Linux fallback when the API
          // output is empty/absent (truly unrecognised command).
          const serverOutput = (d.output || "").replace(/(?<!\r)\n/g, "\r\n");
          if (serverOutput.trim()) {
            term.write(serverOutput);
          } else {
            // Nothing useful from server — fall back to Linux command simulation
            const fallbackOut = runFallback(t);
            if (fallbackOut !== null) {
              if (fallbackOut === "__CLEAR__") {
                term.clear();
                busyRef.current = false;
                showPrompt();
                return;
              } else if (fallbackOut === "__EXIT__") {
                setTimeout(onClose, 300);
                busyRef.current = false;
                return;
              } else if (fallbackOut !== "") {
                term.write(fallbackOut.replace(/(?<!\r)\n/g, "\r\n"));
              }
            } else {
              // FIX #7: Missing \r\n after command-not-found caused prompt to
              // appear on the same line as the error message.
              term.write(`${R}bash: ${t}: command not found${X}\r\n`);
            }
          }
        }
      } catch (err) {
        const fallbackOut = runFallback(t);
        if (fallbackOut !== null && fallbackOut !== "__EXIT__") {
          if (fallbackOut === "__CLEAR__") {
            term.clear();
          } else if (fallbackOut !== "") {
            term.write(fallbackOut.replace(/(?<!\r)\n/g, "\r\n"));
          }
        } else {
          term.write(`${R}bash: connection error — try again${X}\r\n`);
        }
      } finally {
        busyRef.current = false;
        showPrompt();
      }
    },
    [showPrompt, switchToRoot, activeSuspectId, onClose, markCompleted],
  );

  const handleData = useCallback(
    (data: string) => {
      const term = termRef.current;
      if (!term) return;

      // Root mode: keystrokes forwarded directly to WebSocket via the onData
      // listener registered in switchToRoot — nothing to do here.
      if (modeRef.current === "root") return;

      if (modeRef.current === "root-fallback") {
        if (busyRef.current) return;
        if (data === "\r") {
          const cmd = inputRef.current;
          inputRef.current = "";
          processRootFallbackCmd(cmd);
        } else if (data === "\x7f") {
          if (inputRef.current.length > 0) {
            inputRef.current = inputRef.current.slice(0, -1);
            term.write("\x1b[D\x1b[K");
          }
        } else if (data === "\x1b[A") {
          if (histIdxRef.current < cmdHistRef.current.length - 1) {
            histIdxRef.current++;
            const cmd =
              cmdHistRef.current[
                cmdHistRef.current.length - 1 - histIdxRef.current
              ];
            inputRef.current = cmd;
            term.write(`\x1b[2K\r\x1b[1A\x1b[2K\r${ROOT_PROMPT}${cmd}`);
          }
        } else if (data === "\x1b[B") {
          if (histIdxRef.current > 0) {
            histIdxRef.current--;
            const cmd =
              cmdHistRef.current[
                cmdHistRef.current.length - 1 - histIdxRef.current
              ];
            inputRef.current = cmd;
            term.write(`\x1b[2K\r\x1b[1A\x1b[2K\r${ROOT_PROMPT}${cmd}`);
          } else if (histIdxRef.current === 0) {
            histIdxRef.current = -1;
            inputRef.current = "";
            term.write(`\x1b[2K\r\x1b[1A\x1b[2K\r${ROOT_PROMPT}`);
          }
        } else if (data.charCodeAt(0) >= 32) {
          inputRef.current += data;
          term.write(data);
        }
        return;
      }

      if (busyRef.current) return;
      if (data === "\r") {
        processCmd(inputRef.current);
        inputRef.current = "";
      } else if (data === "\x7f") {
        if (inputRef.current.length > 0) {
          inputRef.current = inputRef.current.slice(0, -1);
          term.write("\x1b[D\x1b[K");
        }
      } else if (data === "\x1b[A") {
        if (histIdxRef.current < cmdHistRef.current.length - 1) {
          histIdxRef.current++;
          const cmd =
            cmdHistRef.current[
              cmdHistRef.current.length - 1 - histIdxRef.current
            ];
          inputRef.current = cmd;
          term.write(`\x1b[2K\r\x1b[1A\x1b[2K\r${GAME_PROMPT}${cmd}`);
        }
      } else if (data === "\x1b[B") {
        if (histIdxRef.current > 0) {
          histIdxRef.current--;
          const cmd =
            cmdHistRef.current[
              cmdHistRef.current.length - 1 - histIdxRef.current
            ];
          inputRef.current = cmd;
          term.write(`\x1b[2K\r\x1b[1A\x1b[2K\r${GAME_PROMPT}${cmd}`);
        } else if (histIdxRef.current === 0) {
          histIdxRef.current = -1;
          inputRef.current = "";
          term.write(`\x1b[2K\r\x1b[1A\x1b[2K\r${GAME_PROMPT}`);
        }
      } else if (data.charCodeAt(0) >= 32) {
        inputRef.current += data;
        term.write(data);
      }
    },
    [processCmd, processRootFallbackCmd],
  );

  handleDataRef.current = handleData;

  useEffect(() => {
    if (!open || !containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: "block",
      fontFamily:
        "'JetBrains Mono','Fira Code','Cascadia Code',ui-monospace,Consolas,monospace",
      fontSize: 13,
      lineHeight: 1.2,
      scrollback: 5000,
      theme: KALI_THEME_GAME,
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    term.onData((d) => handleDataRef.current(d));
    termRef.current = term;
    fitRef.current = fit;

    setTimeout(() => {
      fit.fit();
      writeBanner(term, task.title);
      term.write(GAME_PROMPT);
    }, 40);

    // FIX #8: sessionRef was never reset to null on cleanup, so reopening
    // the terminal reused a stale/expired session ID from the previous mount.
    if (sessionRef.current == null) {
      api
        .post<{ id: number }>("/play-sessions", { taskId: task.id })
        .then((r) => {
          sessionRef.current = r.data.id;
          if (pendingCmdRef.current) {
            const cmd = pendingCmdRef.current;
            pendingCmdRef.current = null;
            processCmd(cmd);
          }
        })
        .catch(() => term.write(`\r\n${R}[!] Session error${X}\r\n`));
    }

    const ro = new ResizeObserver(() => {
      fit.fit();
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        const d = fit.proposeDimensions();
        if (d)
          ws.send(
            JSON.stringify({ type: "resize", cols: d.cols, rows: d.rows }),
          );
      }
    });
    ro.observe(containerRef.current);

    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);

    return () => {
      window.removeEventListener("keydown", onEsc);
      ro.disconnect();
      wsRef.current?.close();
      wsRef.current = null;

      // FIX #1 (cleanup): Dispose root onData listener on unmount
      rootOnDataDisposableRef.current?.dispose();
      rootOnDataDisposableRef.current = null;

      term.dispose();
      termRef.current = null;
      fitRef.current = null;

      // FIX #8 (cleanup): Reset session so next open creates a fresh one
      sessionRef.current = null;

      modeRef.current = "game";
      setMode("game");
    };
  }, [open, task.id, task.title]); // eslint-disable-line

  useEffect(() => {
    setTimeout(() => {
      fitRef.current?.fit();
      const ws = wsRef.current;
      const fit = fitRef.current;
      if (ws?.readyState === WebSocket.OPEN && fit) {
        const d = fit.proposeDimensions();
        if (d)
          ws.send(
            JSON.stringify({ type: "resize", cols: d.cols, rows: d.rows }),
          );
      }
    }, 60);
  }, [isMax]);

  const isRoot = mode === "root" || mode === "root-fallback";
  const isFallback = mode === "root-fallback";
  const tabTitle = isRoot ? "root@kali: ~" : "detective@kali: ~/investigation";
  const bgColor = isRoot ? "#0d0d0d" : "#1c1c1c";
  const barColor = isRoot ? "#1a0000" : "#2b2b2b";

  const winStyle: React.CSSProperties = isMax
    ? { position: "fixed", inset: 0, borderRadius: 0 }
    : {
        position: "fixed",
        top: "3vh",
        left: "3vw",
        right: "3vw",
        bottom: "3vh",
        borderRadius: 4,
        boxShadow:
          "0 24px 80px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.07)",
      };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9998,
              background: "rgba(0,0,0,0.72)",
              backdropFilter: "blur(3px)",
            }}
          />
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            style={{
              ...winStyle,
              zIndex: 9999,
              display: "flex",
              flexDirection: "column",
              background: bgColor,
              overflow: "hidden",
              fontFamily: "'JetBrains Mono','Fira Code',ui-monospace,monospace",
              transition: "background 0.35s",
            }}
          >
            {/* Title bar */}
            <div
              style={{
                height: 26,
                background: barColor,
                borderBottom: "1px solid rgba(0,0,0,0.6)",
                display: "flex",
                alignItems: "center",
                padding: "0 6px",
                flexShrink: 0,
                userSelect: "none",
                transition: "background 0.35s",
              }}
            >
              <span style={{ fontSize: 11, opacity: 0.5, marginRight: 6 }}>
                🖥
              </span>
              <span
                style={{
                  flex: 1,
                  textAlign: "center",
                  fontSize: 11,
                  letterSpacing: 0.2,
                  color: isRoot ? "#ff6666" : "rgba(238,238,236,0.65)",
                  transition: "color 0.35s",
                }}
              >
                {tabTitle}
                {isRoot
                  ? isFallback
                    ? " — ROOT SHELL [SIMULATION]"
                    : " — ROOT SHELL ACTIVE"
                  : " — Terminal"}
              </span>
              <div style={{ display: "flex", gap: 1 }}>
                <WBtn symbol="─" onClick={() => {}} />
                <WBtn
                  symbol={isMax ? "❐" : "□"}
                  onClick={() => setIsMax((v) => !v)}
                />
                <WBtn symbol="×" onClick={onClose} danger={isRoot} />
              </div>
            </div>

            {/* Menu bar */}
            <div
              style={{
                height: 22,
                background: isRoot ? "#0f0f0f" : "#252525",
                borderBottom: "1px solid rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                padding: "0 2px",
                flexShrink: 0,
                userSelect: "none",
                transition: "background 0.35s",
              }}
            >
              {["File", "Edit", "View", "Terminal", "Help"].map((l) => (
                <MItem key={l} label={l} isRoot={isRoot} />
              ))}
              {isRoot && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    marginLeft: "auto",
                    marginRight: 8,
                    background: isFallback
                      ? "rgba(255,170,0,0.2)"
                      : "rgba(255,51,51,0.3)",
                    border: `1px solid ${isFallback ? "rgba(255,170,0,0.6)" : "rgba(255,51,51,0.6)"}`,
                    borderRadius: 2,
                    padding: "0 7px",
                    color: isFallback ? "#ffaa00" : "#ff6666",
                    fontSize: 9,
                    letterSpacing: 1.5,
                    fontWeight: 700,
                  }}
                >
                  {isFallback ? "SIMULATION" : "ROOT SHELL"}
                </motion.span>
              )}
            </div>

            {/* Tab bar */}
            <div
              style={{
                height: 26,
                background: isRoot ? "#0a0a0a" : "#222222",
                borderBottom: "1px solid rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "flex-end",
                paddingLeft: 4,
                flexShrink: 0,
                userSelect: "none",
                transition: "background 0.35s",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  background: bgColor,
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderBottom: `1px solid ${bgColor}`,
                  borderRadius: "3px 3px 0 0",
                  padding: "3px 10px 4px",
                  marginBottom: -1,
                }}
              >
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M2 4.5L6 7 2 9.5"
                    stroke={isRoot ? "#ff6666" : "#4e9a06"}
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <line
                    x1="7.5"
                    y1="9.5"
                    x2="12"
                    y2="9.5"
                    stroke={isRoot ? "#ff6666" : "#4e9a06"}
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
                <span
                  style={{
                    color: isRoot ? "#ffaa00" : "rgba(238,238,236,0.78)",
                    fontSize: 11,
                    whiteSpace: "nowrap",
                    maxWidth: 280,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    transition: "color 0.35s",
                  }}
                >
                  {tabTitle}
                </span>
                <button
                  onClick={onClose}
                  style={{
                    background: "none",
                    border: "none",
                    color: isRoot
                      ? "rgba(255,102,102,0.5)"
                      : "rgba(238,238,236,0.28)",
                    fontSize: 13,
                    cursor: "pointer",
                    padding: "0 0 0 4px",
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Terminal canvas */}
            <div
              ref={containerRef}
              style={{
                flex: 1,
                minHeight: 0,
                overflow: "hidden",
                padding: "4px 0 0 4px",
                background: bgColor,
                transition: "background 0.35s",
              }}
            />

            {/* Progress panel — visible only in game mode when there are commands */}
            {mode !== "root" && sortedCmds.length > 0 && (
              <div
                style={{
                  flexShrink: 0,
                  background: "#252525",
                  borderTop: "1px solid #2e2e2e",
                  fontFamily:
                    "'JetBrains Mono','Fira Code',ui-monospace,monospace",
                }}
              >
                {/* Progress bar row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 12px 5px",
                    borderBottom: "1px solid #2e2e2e",
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      color: "#4e9a06",
                      letterSpacing: 1.2,
                      flexShrink: 0,
                      fontFamily: "'JetBrains Mono',monospace",
                    }}
                  >
                    {completedSteps === totalSteps && totalSteps > 0
                      ? "✔"
                      : "›"}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: 3,
                      borderRadius: 2,
                      background: "#2e2e2e",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        borderRadius: 2,
                        width: `${totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0}%`,
                        background:
                          completedSteps === totalSteps && totalSteps > 0
                            ? "#8ae234"
                            : "#4e9a06",
                        transition: "width 0.45s ease",
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: "'JetBrains Mono',monospace",
                      color: completedSteps > 0 ? "#8ae234" : "#555753",
                      minWidth: 28,
                      textAlign: "right",
                      flexShrink: 0,
                      transition: "color 0.3s",
                    }}
                  >
                    {completedSteps}/{totalSteps}
                  </span>
                </div>

                {/* Command chips row */}
                <div
                  style={
                    {
                      display: "flex",
                      overflowX: "auto",
                      padding: "5px 8px 6px",
                      gap: 4,
                      scrollbarWidth: "none",
                      msOverflowStyle: "none",
                    } as React.CSSProperties
                  }
                >
                  {displayCmds.map((cmd) => {
                    const isDone = cmd._done;
                    const isFinal = !!cmd.isFinalStep;
                    return (
                      <div
                        key={cmd.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          flexShrink: 0,
                          padding: "2px 7px 2px 5px",
                          borderRadius: 3,
                          border: "1px solid #2e2e2e",
                          background: isDone
                            ? "rgba(78,154,6,0.1)"
                            : "transparent",
                          transition: "background 0.3s",
                          cursor: "default",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            color: isDone ? "#4e9a06" : "#555753",
                            lineHeight: 1,
                            flexShrink: 0,
                          }}
                        >
                          {isDone ? "✓" : "○"}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            color: isDone ? "#555753" : "#888780",
                            textDecoration: isDone ? "line-through" : "none",
                            maxWidth: 130,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            opacity: isDone ? 0.5 : 1,
                          }}
                        >
                          {cmd.hint || cmd.command}
                        </span>
                        {isFinal && (
                          <span
                            style={{
                              fontSize: 9,
                              color: isDone ? "#4e9a06" : "#555753",
                              flexShrink: 0,
                              marginLeft: 1,
                            }}
                          >
                            ★
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Auto-captured indicator — shown when all steps done */}
                {completedSteps === totalSteps &&
                  totalSteps > 0 &&
                  onTerminalComplete && (
                    <div
                      style={{
                        borderTop: "1px solid #2e2e2e",
                        padding: "5px 12px",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        background: "rgba(78,154,6,0.07)",
                      }}
                    >
                      <span style={{ fontSize: 10, color: "#8ae234" }}>✔</span>
                      <span
                        style={{
                          fontSize: 10,
                          color: "#8ae234",
                          fontFamily: "'JetBrains Mono',monospace",
                          letterSpacing: 0.4,
                        }}
                      >
                        Результат терминала сохранен — будет отправлен в сводку
                      </span>
                    </div>
                  )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * FIX #4 helper: Client-side fallback for finding which TerminalCommand was
 * matched by the user's input. Only used when the server doesn't return
 * matchedCommandId. Isolated here so the match logic is easy to audit and
 * keep in sync with the server.
 */
function findMatchedCmdId(
  input: string,
  cmds: TerminalCommand[],
): number | undefined {
  const t = input.trim().toLowerCase();
  const matched = cmds.find((c) => {
    const cmd = (c.command || "").trim().toLowerCase();
    if (c.matchType === "exact") return t === cmd;
    if (c.matchType === "prefix") return t.startsWith(cmd);
    if (c.matchType === "regex") {
      try {
        return new RegExp(c.command, "i").test(input.trim());
      } catch {
        return false;
      }
    }
    return t === cmd;
  });
  return matched?.id;
}

function WBtn({
  symbol,
  onClick,
  danger,
}: {
  symbol: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 24,
        height: 20,
        background: "transparent",
        border: "none",
        color: danger ? "rgba(255,102,102,0.7)" : "rgba(238,238,236,0.45)",
        fontSize: 12,
        cursor: "pointer",
        borderRadius: 2,
        padding: 0,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.background = danger
          ? "rgba(255,102,102,0.25)"
          : "rgba(255,255,255,0.1)";
        el.style.color = danger ? "#ff6666" : "#eeeeec";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.background = "transparent";
        el.style.color = danger
          ? "rgba(255,102,102,0.7)"
          : "rgba(238,238,236,0.45)";
      }}
    >
      {symbol}
    </button>
  );
}

function MItem({ label, isRoot }: { label: string; isRoot?: boolean }) {
  return (
    <button
      style={{
        background: "transparent",
        border: "none",
        color: isRoot ? "rgba(255,170,0,0.8)" : "rgba(238,238,236,0.72)",
        fontSize: 11,
        padding: "0 8px",
        height: 22,
        cursor: "pointer",
        borderRadius: 2,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background =
          "rgba(255,255,255,0.1)";
        (e.currentTarget as HTMLElement).style.color = isRoot
          ? "#ffaa00"
          : "#eeeeec";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
        (e.currentTarget as HTMLElement).style.color = isRoot
          ? "rgba(255,170,0,0.8)"
          : "rgba(238,238,236,0.72)";
      }}
    >
      {label}
    </button>
  );
}
