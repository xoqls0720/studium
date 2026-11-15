import sys
from PIL import Image, ImageDraw
S = 256; im = Image.new("RGBA", (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
d.rounded_rectangle((8, 8, S - 8, S - 8), 56, fill=(28, 28, 32))
d.rounded_rectangle((78, 30, 178, 226), 22, fill=(235, 235, 240)); d.rounded_rectangle((88, 48, 168, 200), 8, fill=(40, 90, 200))
d.ellipse((120, 206, 136, 222), fill=(28, 28, 32))
d.polygon([(150, 120), (150, 196), (168, 180), (180, 206), (192, 200), (180, 175), (204, 174)], fill=(255, 255, 255), outline=(20, 20, 20))
im.save(sys.argv[1], sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
