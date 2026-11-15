import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert("RGBA")
im.save(sys.argv[2], sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
