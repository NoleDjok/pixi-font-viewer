export const FNT_XML_FULL = `<?xml version="1.0"?>
<font>
  <info face="Gold Numbers" size="64" bold="0" italic="0" charset="" unicode="1" stretchH="100" smooth="1" aa="1" padding="0,0,0,0" spacing="1,1" outline="0"/>
  <common lineHeight="72" base="58" scaleW="256" scaleH="128" pages="2" packed="0" alphaChnl="0" redChnl="4" greenChnl="4" blueChnl="4"/>
  <pages>
    <page id="0" file="gold_0.png" />
    <page id="1" file="gold_1.png" />
  </pages>
  <chars count="3">
    <char id="48" x="0" y="0" width="40" height="60" xoffset="1" yoffset="4" xadvance="42" page="0" chnl="15" />
    <char id="49" x="42" y="0" width="30" height="60" xoffset="2" yoffset="4" xadvance="34" page="0" chnl="15" />
    <char id="36" x="0" y="0" width="38" height="70" xoffset="0" yoffset="0" xadvance="40" page="1" chnl="15" />
  </chars>
  <kernings count="1">
    <kerning first="49" second="48" amount="-3" />
  </kernings>
</font>`;

export const XML_MINIMAL = `<font kernings="1"><info face="Small &amp; Bold" size="32"/><common lineHeight="36" scaleW="128" scaleH="64" pages="1"/><pages><page id="0" file="small.png"/></pages><chars count="2"><char id="65" x="0" y="0" width="20" height="30" xoffset="0" yoffset="2" xadvance="21" page="0"/><char id="66" x="21" y="0" width="19" height="30" page="0"/></chars></font>`;

export const FNT_TEXT = `info face="Arial Black" size=-32 bold=0 italic=0 charset="" unicode=1 padding=0,0,0,0 spacing=1,1
common lineHeight=37 base=29 scaleW=256 scaleH=256 pages=1 packed=0
page id=0 file="arial_0.png"
chars count=2
char id=32   x=0     y=0     width=0     height=0     xoffset=0     yoffset=29    xadvance=8     page=0  chnl=15
char id=65   x=1     y=1     width=22    height=24    xoffset=-1    yoffset=5     xadvance=21    page=0  chnl=15
kernings count=1
kerning first=65 second=65 amount=-1
`;

export const PACKER_ATLAS_JSON = JSON.stringify({
    frames: {
        k: frame(205, 3, 120, 175),
        '0': frame(381, 546, 120, 175),
        ',': frame(331, 3, 66, 175),
        '1': frame(255, 546, 120, 175),
        '.': frame(259, 184, 66, 175),
    },
    meta: { app: '@gamzix/packer', image: 'numbers_1080p.png', format: 'RGBA8888', size: { w: 526, h: 724 }, scale: 1 },
});

export const TEXTURE_PACKER_ATLAS_720 = JSON.stringify({
    frames: {
        dot: { ...frame(0, 0, 50, 131), trimmed: true },
        '9': frame(60, 0, 90, 131),
    },
    meta: { app: 'https://www.codeandweb.com/texturepacker', image: 'numbers_720p_webp.webp', scale: '0.75' },
});

function frame(x: number, y: number, w: number, h: number): Record<string, unknown> {
    return {
        frame: { x, y, w, h },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w, h },
        sourceSize: { w, h },
    };
}
