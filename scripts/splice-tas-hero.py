from pathlib import Path

root = Path(__file__).resolve().parents[1]
p = root / "index-top.html"
text = p.read_text(encoding="utf-8")
start = text.index('        <div class="tas-hero__cards" role="list">')
end = text.index('      <section class="top-search"')
frag = (root / "tas-hero-fragment.html").read_text(encoding="utf-8")
new_text = text[:start] + frag + "\n\n" + text[end:]
old = "      </section>\n    </section>\n\n    <section class=\"top-section"
new = "      </section>\n\n    <section class=\"top-section"
if old in new_text:
    new_text = new_text.replace(old, new, 1)
p.write_text(new_text, encoding="utf-8")
print("spliced", len(frag), "chars")
