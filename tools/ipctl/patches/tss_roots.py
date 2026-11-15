# go-ios: Apple TSS(gs.apple.com) 접속 때 윈도우 인증서 저장소에 Apple 루트 인증서가 없으면
# 검증에 실패한다. Apple 공식 루트 인증서(apple.com/certificateauthority)를 신뢰 목록에 더해
# 정상적으로 검증하게 한다. 인증서 검증은 그대로 켜져 있다.
import sys, os, shutil
pkg, certdir = sys.argv[1], sys.argv[2]
os.makedirs(os.path.join(pkg, "appleroots"), exist_ok=True)
names = []
for f in sorted(os.listdir(certdir)):
    if f.endswith(".cer"):
        shutil.copy(os.path.join(certdir, f), os.path.join(pkg, "appleroots", f)); names.append(f)
assert names, "no certs"
open(os.path.join(pkg, "appleroots.go"), "w").write('''package imagemounter

import (
	"crypto/tls"
	"crypto/x509"
	"embed"
	"net/http"
)

//go:embed appleroots/*.cer
var appleRootFS embed.FS

// appleTransport verifies gs.apple.com against the system roots plus Apple's
// published root certificates.
func appleTransport() http.RoundTripper {
	pool, err := x509.SystemCertPool()
	if err != nil || pool == nil {
		pool = x509.NewCertPool()
	}
	entries, _ := appleRootFS.ReadDir("appleroots")
	for _, e := range entries {
		b, err := appleRootFS.ReadFile("appleroots/" + e.Name())
		if err != nil {
			continue
		}
		if c, err := x509.ParseCertificate(b); err == nil {
			pool.AddCert(c)
		}
	}
	return &http.Transport{Proxy: http.ProxyFromEnvironment, TLSClientConfig: &tls.Config{RootCAs: pool}}
}
''')
p = os.path.join(pkg, "tss.go"); s = open(p, encoding="utf-8").read()
s = s.replace("Transport: http.DefaultTransport,", "Transport: appleTransport(),", 1)
assert "appleTransport()" in s
open(p, "w", encoding="utf-8").write(s)
print("added Apple roots:", names)
