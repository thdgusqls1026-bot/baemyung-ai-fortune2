"""Create real QR for the public Railway URL, after the site has been deployed.
Usage: python scripts/make_qr.py https://your-real-site.up.railway.app
Requires: pip install 'qrcode[pil]'
"""
import sys
from urllib.parse import urlsplit

if len(sys.argv) != 2:
    raise SystemExit('사용법: python scripts/make_qr.py https://배포된-실제-주소')
url = sys.argv[1].strip().rstrip('/')
p = urlsplit(url)
if p.scheme != 'https' or not p.hostname or p.username or p.password:
    raise SystemExit('실제 배포된 HTTPS 사이트 주소를 입력해 주세요.')
try:
    import qrcode
except ImportError:
    raise SystemExit("먼저 pip install 'qrcode[pil]' 을 실행해 주세요.")
img = qrcode.make(url)
img.save('site-qr.png')
print('생성 완료: site-qr.png →',url)
