// 테스트 실행기:  cd tests && npm test   (또는 node run.mjs api e2e …  — 이름으로 골라 실행)
// 1) 화면을 빌드하고  2) 임시 사용자 DB(즐겨찾기/기록)로 별도 포트에 서버를 띄운 뒤  3) 각 테스트 파일을 차례로 돌린다.
// 실제 data/user.sqlite는 건드리지 않는다.
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const PORT = process.env.TEST_PORT ?? '3057'
const BASE = `http://127.0.0.1:${PORT}/`
const userDb = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wikt-test-')), 'user.sqlite')
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'

const all = ['api', 'e2e', 'amo', 'i18n', 'features', 'swadesh']
const wanted = process.argv.slice(2)
const files = wanted.length ? wanted : all

console.log('· 화면 빌드');
{
  const r = spawnSync(npm, ['run', 'build'], { cwd: path.join(root, 'web'), stdio: 'ignore', shell: process.platform === 'win32' })
  if (r.status !== 0) {
    console.error('화면 빌드 실패 (cd web && npm run build 로 확인)')
    process.exit(1)
  }
}

console.log(`· 서버 시작 (${BASE}, 임시 사용자 DB)`)
const server = spawn(npx, ['tsx', 'src/index.ts'], {
  cwd: path.join(root, 'server'),
  env: { ...process.env, PORT, USER_DB: userDb },
  stdio: 'ignore',
  shell: process.platform === 'win32',
})
const stop = () => {
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' })
  else server.kill()
}
process.on('exit', stop)

let ready = false
for (let i = 0; i < 60 && !ready; i++) {
  try {
    ready = (await fetch(BASE + 'api/langs')).ok
  } catch {
    await new Promise((r) => setTimeout(r, 500))
  }
}
if (!ready) {
  console.error('서버가 시작되지 않았습니다.')
  stop()
  process.exit(1)
}

const failed = []
for (const name of files) {
  console.log(`\n===== ${name}`)
  const r = spawnSync(process.execPath, [path.join(import.meta.dirname, `${name}.mjs`)], {
    stdio: 'inherit',
    env: { ...process.env, BASE },
  })
  if (r.status !== 0) failed.push(name)
}
stop()
fs.rmSync(path.dirname(userDb), { recursive: true, force: true })
console.log(failed.length ? `\n✘ 실패한 테스트: ${failed.join(', ')}` : '\n✔ 전체 통과')
process.exit(failed.length ? 1 : 0)
