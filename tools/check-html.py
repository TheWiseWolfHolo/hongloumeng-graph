import sys
from html.parser import HTMLParser

VOID = {"area","base","br","col","embed","hr","img","input","link","meta",
        "param","source","track","wbr"}

class Check(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.errs = []

    def handle_starttag(self, tag, attrs):
        if tag not in VOID:
            self.stack.append((tag, self.getpos()))

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if not self.stack:
            self.errs.append(f"line {self.getpos()[0]}: stray </{tag}>")
            return
        if self.stack[-1][0] == tag:
            self.stack.pop()
        else:
            for i in range(len(self.stack) - 1, -1, -1):
                if self.stack[i][0] == tag:
                    for t, pos in self.stack[i + 1:]:
                        self.errs.append(f"line {pos[0]}: <{t}> never closed")
                    del self.stack[i:]
                    break
            else:
                self.errs.append(f"line {self.getpos()[0]}: stray </{tag}>")

path = sys.argv[1]
src = open(path, encoding="utf-8").read()
c = Check()
c.feed(src)
c.close()
for t, pos in c.stack:
    c.errs.append(f"line {pos[0]}: <{t}> never closed (EOF)")

if c.errs:
    print("STRUCTURE ERRORS:")
    for e in c.errs:
        print("  " + e)
    sys.exit(1)
print("HTML structure OK")
