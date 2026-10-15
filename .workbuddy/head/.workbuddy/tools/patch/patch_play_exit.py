# -*- coding: utf-8 -*-
import io
for f in [r'E:\Deepseekdb\.workbuddy\tools\playtest\play_gold_600x.js',
          r'E:\Deepseekdb\.workbuddy\tools\playtest\play_farm2_600x.js']:
    s = io.open(f, encoding='utf-8', newline='').read()
    old = "console.log('DONE ' + TAG + ' ticks=' + MAXT + ' errs=' + ERRN);"
    new = old + "\nprocess.exit(0);   /* v89.91：跑完即退（游戏定时器会挂住事件循环） */"
    if 'process.exit(0)' in s:
        print('SKIP', f)
    else:
        assert s.count(old) == 1, f
        io.open(f, 'w', encoding='utf-8', newline='').write(s.replace(old, new, 1))
        print('OK', f)
