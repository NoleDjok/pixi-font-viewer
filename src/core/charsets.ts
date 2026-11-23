export interface ITextPreset {
    id: string;
    label: string;
    text: string;
}

export const FONT_GLYPHS_PRESET_ID = 'font-glyphs';
export const PRESET_LINE_LENGTH = 16;

export const TEXT_PRESETS: readonly ITextPreset[] = [
    {
        id: 'win-amounts',
        label: 'Win amounts',
        text: ['0123456789', '1,234.56', '12.5k 3.2m', 'x2 x10 x100', '+250', '1/5'].join('\n'),
    },
    { id: FONT_GLYPHS_PRESET_ID, label: 'Every glyph of the font', text: '' },
    { id: 'digits-punctuation', label: 'Digits & punctuation', text: '0123456789\n.,:;!?-+%/()#&*"\'' },
    { id: 'latin', label: 'Latin A–Z a–z', text: 'ABCDEFGHIJKLM\nNOPQRSTUVWXYZ\nabcdefghijklm\nnopqrstuvwxyz' },
    {
        id: 'latin-extended',
        label: 'Latin extended (EU)',
        text: chunkLines(
            'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿĄąĆćĘęŁłŃńŚśŹźŻżČčĎďĚěŇňŘřŠšŤťŮůŽžŐőŰű',
        ),
    },
    {
        id: 'cyrillic',
        label: 'Cyrillic (UA, BG, RU)',
        text: chunkLines('АБВГҐДЕЄЁЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгґдеєёжзиіїйклмнопрстуфхцчшщъыьэюяʼ'),
    },
    {
        id: 'greek',
        label: 'Greek',
        text: chunkLines('ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρσςτυφχψωΆΈΉΊΌΎΏάέήίόύώϊϋΐΰ'),
    },
    { id: 'turkish', label: 'Turkish', text: 'ÇçĞğİıÖöŞşÜü' },
    {
        id: 'vietnamese',
        label: 'Vietnamese',
        text: chunkLines(
            'ĂăÂâĐđÊêÔôƠơƯưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ' +
                'ÀÁẢÃẠẰẮẲẴẶẦẤẨẪẬÈÉẺẼẸỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌỒỐỔỖỘỜỚỞỠỢÙÚỦŨỤỪỨỬỮỰỲÝỶỸỴ',
        ),
    },
    { id: 'currency', label: 'Currency symbols', text: '$€£¥₩₹₽₺₴₿¢₦₱₫₪₸₼₾\n1,000 $ 1.000 € ₴ 100' },
    {
        id: 'legacy-sample',
        label: 'Old viewer sample',
        text: [
            'ABCDEFGHIJKLMNO',
            'PRSTUVZYXQW',
            'abcdefghijklmno',
            'prstuvzyxqw',
            '01234 567 89',
            '?!;:-+"#"/()%&><,.',
            '°*₩ɱⱣ₨₿$₣¥č€£ŁΞКĐ',
        ].join('\n'),
    },
];

export function chunkLines(chars: string, perLine: number = PRESET_LINE_LENGTH): string {
    const list = Array.from(chars);
    const lines: string[] = [];

    for (let index = 0; index < list.length; index += perLine) {
        lines.push(list.slice(index, index + perLine).join(''));
    }

    return lines.join('\n');
}
