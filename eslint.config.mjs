/* eslint.config.mjs —— dev 期静态检查（v156.14 起）
 *
 * 定位：**不替代**项目自己的五件套 + audit，只补两件它们结构上抓不到的事：
 *   ① `no-undef` —— 全局命名空间 GAME/DATA/U 上的拼写错误（`GAME.foo` 打错字不会报错，
 *      三元判断会把它静默吞掉；audit 只扫已知模块内定义，扫不到"根本不存在的名字"）
 *   ② `no-redeclare` / `no-dupe-keys` / `no-unreachable` —— 同一文件内的低级错误
 *
 * 为什么不开 `no-unused-vars`：`audit.js` 已有更准的「死函数 / 零引用」判据（按 GAME 命名空间
 * 统计 + 白名单带理由），两套口径会互相打架。这里只做 audit 不做的。
 *
 * 为什么不在这写"分层墙"：本项目的耦合走**全局对象**（`GAME.ui`），不走 import 图
 * （源文件的 `import './x.js'` 只是求值顺序，bundle 时会剥掉），
 * 所以 dependency-cruiser 之类「按 import 边」的工具会量到没有信息量的图。
 * 分层棘轮仍由 `tools/diag-arch.js --check` 守（读的是 GAME.x 引用），这条别换。
 */
export default [
  {
    ignores: [
      'js/bundle-core.js',
      'js/bundle-war.js',
      'js/bundle-ui.js',
      'vendor/**',
      'node_modules/**',
      'assets/**',
      '.workbuddy/**',
      'tools/_shots/**',
      'tools/_preserve/**',
      'new-wasteland/**',   /* 独立原型，不接主仓门禁 */
    ],
  },
  {
    files: ['js/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',       /* 源文件顶层用 import './x.js' 表达执行顺序；bundle 时被剥 */
      globals: {
        /* 项目自己的全局槽（core.js 建的单例 + 三个包共享） */
        GAME: 'writable',
        DATA: 'writable',
        U: 'writable',
        THREE: 'readonly',
        /* 浏览器 */
        window: 'readonly', document: 'readonly', navigator: 'readonly',
        location: 'readonly', localStorage: 'readonly', sessionStorage: 'readonly',
        console: 'readonly', performance: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly',
        setInterval: 'readonly', clearInterval: 'readonly',
        requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly',
        alert: 'readonly', confirm: 'readonly', prompt: 'readonly',
        Image: 'readonly', Blob: 'readonly', URL: 'readonly',
        FileReader: 'readonly', TextDecoder: 'readonly', TextEncoder: 'readonly',
        fetch: 'readonly', DOMParser: 'readonly', XMLSerializer: 'readonly',
        /* 工具脚本注入的（smoke/e2e 在 node 下跑） */
        module: 'readonly', require: 'readonly', __dirname: 'readonly',
        __filename: 'readonly', process: 'readonly', Buffer: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
      'no-redeclare': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-dupe-class-members': 'error',
      'no-unreachable': 'warn',
      'no-fallthrough': 'warn',
      'no-const-assign': 'error',
      'no-self-assign': 'warn',
      /* 全项目用 var + 老式写法，这些开起来只会刷屏，不开 */
      'no-var': 'off',
      'prefer-const': 'off',
      'no-unused-vars': 'off',
      'no-empty': 'off',
      'no-cond-assign': 'off',
    },
  },
];
