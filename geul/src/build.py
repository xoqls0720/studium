import re
t=open('/home/claude/toeic/app2.html',encoding='utf-8').read()
css=t[t.index('<style>')+7:t.index('</style>')]
pdf=t[t.index('// ---------- 화면 문서 → PDF'):t.index('const VIEWS=')]
a=open('/home/claude/studium/geul/src/app.html',encoding='utf-8').read()
d=open('/home/claude/studium/geul/src/data.js',encoding='utf-8').read()
a=a.replace('/*CSS*/',css,1).replace('/*PDF*/',pdf,1).replace('/*DATA*/',d,1)
open('/home/claude/studium/geul/index.html','w',encoding='utf-8').write(a)
print(len(a))
