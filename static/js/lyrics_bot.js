
document.addEventListener('DOMContentLoaded', function () {
    const lyricsInput = document.getElementById('lyricsInput');
    const wordCount = document.getElementById('wordCount');
    const lineCount = document.getElementById('lineCount');

    function updateCounts() {
        if (!lyricsInput) return;
        const text = lyricsInput.value.trim();
        const words = text ? text.split(/\s+/).length : 0;
        const lines = text ? text.split('\n').filter(l => l.trim()).length : 0;
        if (wordCount) wordCount.textContent = words;
        if (lineCount) lineCount.textContent = lines;
    }

    if (lyricsInput) {
        lyricsInput.addEventListener('input', updateCounts);
        updateCounts();
    }
});

function clearLyrics() {
    const lyricsInput = document.getElementById('lyricsInput');
    if (lyricsInput) {
        lyricsInput.value = '';
        lyricsInput.dispatchEvent(new Event('input'));
    }
}

let studioAudio = document.getElementById('studioAudio');
let playIcon = document.getElementById('playIcon');
let currentTitle = document.getElementById('currentTitle');
let currentArtist = document.getElementById('currentArtist');
let currentCover = document.getElementById('currentCover');
let isPlaying = false;
let currentGenre = 'default';

function selectBeat(url, name, artist, color, genre) {
    if (!studioAudio) studioAudio = document.getElementById('studioAudio');
    if (!currentTitle) currentTitle = document.getElementById('currentTitle');
    if (!currentArtist) currentArtist = document.getElementById('currentArtist');
    if (!currentCover) currentCover = document.getElementById('currentCover');
    if (!studioAudio) return;

    studioAudio.src = url;
    if (currentTitle) currentTitle.textContent = name;
    if (currentArtist) currentArtist.textContent = artist;
    if (currentCover) currentCover.style.background = color;
    currentGenre = genre ? genre.toLowerCase() : 'trap';

    studioAudio.play().then(() => {
        isPlaying = true;
        updatePlayIcon();
    }).catch(e => console.log("Audio play error:", e));

    addMessage(`🎵 **${name}** çalıyor! (${genre}). Sana bu beat'e özgü orijinal sözler yazabilirim. "Söz yaz" demen yeterli!`, 'bot');
}

function togglePlay() {
    if (!studioAudio) studioAudio = document.getElementById('studioAudio');
    if (!studioAudio || !studioAudio.src) return alert("Lütfen önce bir beat seçin!");
    if (isPlaying) { studioAudio.pause(); isPlaying = false; }
    else { studioAudio.play(); isPlaying = true; }
    updatePlayIcon();
}

function updatePlayIcon() {
    if (!playIcon) playIcon = document.getElementById('playIcon');
    if (!playIcon) return;
    if (isPlaying) playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
    else playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
}

const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');

// DEV ŞARKI VERİTABANI - 500+ SATIR
const LYRIC_DB = {
    'trap': [
        "Gece çöktü yine, sokaklar buz gibi (buz)",
        "Cebimde hayaller, aklımda o bizi",
        "Para pul yalan, kardeşlik baki",
        "Zirveye tırmanış, durmak yok sanki (skrrt)",
        "Bass'lar vurur, kalbim hızlanır",
        "Düşmanlar konuşur, ama boş lafır",
        "Marka giyinmekle adam olunmaz",
        "Bizim ortam serttir, yanlış yapılmaz",
        "Gecenin köründe farlar yanar (vınn)",
        "Polis peşimde ama izimi bulamaz",
        "Mahallede saygı, hak edene verilir",
        "Paralar sayılır, deste deste (cash)",
        "Yıldızlara bakıp dua ettim anne",
        "Çamurdan çıktık, şimdi zirvedeyiz",
        "Sözlerim mermi, deler geçer zırhı",
        "Yalan dünya kime kalmış ki bize kalsın",
        "Sırtımdan vuranlar şimdi dost sanır",
        "Gözlerimde ateş, içimde buz dağı",
        "Her düşüş bir ders, kalk ve devam et",
        "Zaman akar gider, yakalayamazsın",
        "Lamborghini sürer, eskiden yayan gezdim",
        "Hayatı bir film yaptım, ben başrolde",
        "Hater'lar izler, ben sahneyi yakarım",
        "Rolex'te zaman durmuş, hâlâ çalışırım",
        "Flow'um su gibi akar, durdurana prim yok",
        "Geceler şahidim, ne çok emek verdim",
        "Herkes mutlu sanır, içimde fırtına",
        "Yükseliş başladı, inmek yok artık",
        "Stüdyo evim oldu, beat'ler ailem",
        "Verse'ler kılıç, hook'lar kalkan",
        "Rap'in askeriyim, savaş modunda",
        "Dediler olmaz, şimdi dinlerler beni",
        "Hayaller gerçek oldu, çalış ve inan",
        "Altın plaklar duvarda, hâlâ aç gibiyim",
        "Mikrofonla doğdum, sahnede öleceğim",
        "Sokağın sesi olduk, kimse susturamaz",
        "Karanlık gecelerde yıldız gibi parlarız",
        "Zenginlik kalpte başlar, cebinde değil",
        "Her bar'ım bir hikaye, her hook bir yara",
        "Küllerin içinden Zümrüd-ü Anka gibi",
        "Eskiden boş cep, şimdi dolu hesap",
        "Yol uzun, adımlar kararlı",
        "Kimse bana inanmazken ben inandım",
        "Gece gündüz çalıştım, tatil bilmem",
        "Ayaklarım yerde, gözlerim gökte",
        "Her şarkı bir veda, her beat bir merhaba",
        "Sokaktan gelen, sokağı unutmaz",
        "Patronla değil, kendinle yarış",
        "Bugün zor, yarın güzel olacak",
        "Mürekkep damarımda akar"
    ],
    'drill': [
        "Maskede yüzler, kimse tanımaz (woah)",
        "Londra'dan İstanbul'a herkes bizi konuşur",
        "Ops'lar peşimde ama yakalayamaz",
        "Mahalle bizim, kurallar bizden sorulur",
        "Karanlık işler, aydınlık düşler",
        "Silahtan çıkan ses değil, sözlerim deşer",
        "Glock belimde değil, beynimde (pow)",
        "Sokak sanatı bu, kanla değil",
        "Adalet yoksa, biz sağlarız düzeni",
        "Sessizce geliriz, fırtına gibi",
        "Dostunu iyi seç, yılanlar çoktur",
        "Arkadan konuşan yüzüne güler",
        "Bizde geri vites yok, hep ileri",
        "Bedel ödedik, şimdi tahsilat vakti",
        "Karanlık sokaklar evimiz oldu",
        "Kurdun dişine kan değdi bir kere",
        "Kimseye güvenme, gölgen bile terk eder",
        "Buralar tekin değil, bas dikkatli",
        "Siren sesleri ninnimiz oldu",
        "Ölümle dans ederiz her gece",
        "Block'ta büyüdük, beton asfalt yatağımız",
        "Sliding yapma, sonuçlarına hazır ol",
        "Gang biziz, diğerleri kopyalar",
        "12 gelir, biz dağılırız gölgelere",
        "Paranoya bir yaşam tarzı oldu",
        "Dışarıda gülümseme, içeride savaş",
        "Herkesin bir fiyatı var bu sokakta",
        "Trap house değil, biz gerçek yaşıyoruz",
        "Glide ile değil, Flow ile vururuz",
        "Sokağın kanunu farklı yazılır",
        "Gecenin çocukları, gündüzü sevmez",
        "Her köşede bir hikaye, çoğu acı",
        "Ayakta kalanlar kazanır bu savaşı",
        "Drill beat'i çalar, kalpler hızlanır",
        "UK'den Chicago'ya, aynı dili konuşuruz",
        "Bıçak sırtında yürür gibi her gün",
        "Abi deme, kanıtla kendini",
        "Kapuşon çek, kimlik gizle",
        "Bu müzik terapimiz, anlatan tek şey",
        "Slide etmeden düşün iki kere",
        "Opps görünce yüzler değişir",
        "Gözler her yerde, dikkatli ol",
        "Kaldırımlar tanık, ne çok şey gördü",
        "Kardeşlik sokakta öğrenilir",
        "Her gece aynı film, farklı sahne",
        "Sadakat para etmez bu günlerde",
        "Sert görünüm, yumuşak kalp",
        "Çete değil aile dedik",
        "Geceyi sevdik, bizi sakladı",
        "Drill'in çocuklarıyız, sesimiz gür"
    ],
    'melodic trap': [
        "Yıldızlar altında seni düşledim (yeah)",
        "Kalbim kırık ama yine de gülümsedim",
        "Sensiz geçen her an bir yıl gibi",
        "Gözyaşlarım akar, sel olur sanki",
        "Ay ışığı vurur yüzüne, parlar",
        "Unutamam seni, anılar yakar",
        "Son bir kez bak gözlerime gitmeden",
        "Rüyalarım seninle dolu, uyanmak istemem",
        "Aşk dediğin zehirli bir sarmaşık",
        "Sarıldıkça batar dikenleri kalbime",
        "Uzaklarda arama, ben hep yanındayım",
        "Gökyüzü ağlar benim yerime (yağmur)",
        "Melodiler anlatır söyleyemediklerimi",
        "Kayıp bir şehir gibiyim sensiz",
        "Dön gel desem, gururum el vermez",
        "Belki başka bir hayatta buluşuruz",
        "Seninle yandım, kül oldum savruldum",
        "Her şarkı seni hatırlatır bana",
        "Geceler şahidim, ne çok sevdim seni",
        "Veda etmedim, edemedim...",
        "Telefonunda hâlâ fotoğraflarımız",
        "Sildin mi yoksa ben mi silindim hayatından",
        "Her yağmur damlası senin için ağlar",
        "Gittin de bir parçamı götürdün yanında",
        "Saat 3, uyku gelmez gözüme",
        "Tavanı sayar dururum yıldız gibi",
        "Geceyle dost olduk, gündüz yabancı",
        "Karanlıkta en iyi düşünürüm seni",
        "Parfümün hâlâ yastığımda kalıntı",
        "Sevda dediğin yangın, söndürülmez",
        "Dudaklarından akan her söz zehir oldu",
        "Kırık kalple yaşanır mı bilmem",
        "Son mesajına hâlâ cevap yazamadım",
        "Fotoğraf albümü kaldı senden geriye",
        "Yürürüm sokaklarda, her köşe sen",
        "Aşk şarkıları dinlemek acıtıyor",
        "Melodi ağlar, sözler dayanamaz",
        "Gözlerin kapansa bile görürüm seni",
        "Rüyamda bile bırakmıyorsun yakamı",
        "Auto-tune değil, bu gerçek gözyaşı"
    ],
    'lo-fi': [
        "Kahvem elimde, yağmur camda",
        "Düşünceler dalgın, hepsi birer damla",
        "Eski günler aklımda, huzur ararım",
        "Sessizce yürüyorum, kendimi bulurum",
        "Kitaplar, notlar, yorgun gözler",
        "Zaman akıp gider, geriye ne kalır?",
        "Radyoda eski bir şarkı çalar",
        "Sokak lambaları titrek yanar",
        "Kendi halimde bir dünya kurdum",
        "Gürültüden uzak, huzura yakın",
        "Pencere kenarı, hayal köşesi",
        "Melankoli değil bu, dinginlik",
        "Her nota bir anı saklar içinde",
        "Yavaşça demlenen çay gibi ömür",
        "Sayfalar arasında kurumuş bir gül",
        "Belki yarın daha güzel olur",
        "Gökyüzü gri ama ruhum renkli",
        "Sessizliğin sesi en güzel melodi",
        "Uyumak, rüyalara kaçmak demek",
        "Sabah ışığı odama dolarken...",
        "Vinil çalar döner, nostalji sarar",
        "Kafe köşesinde dünya durur",
        "Yağmur sesi en iyi arkadaşım",
        "Deftere yazdım, kimse okumaz",
        "Vintage havası, modern ruh hali",
        "Ağır çekim hayat, hızlı düşünceler",
        "Cam kenarı, buğu, parmak izleri",
        "Anılar bir kutu dolusu fotoğraf",
        "Slow motion'da geçiyor günler",
        "Kütüphane sessizliği, kalp kalabalığı",
        "Her yudumda bir hatıra canlanır",
        "Sokak müzisyenleri şehrin sesi",
        "Yürürüm dar sokaklarda, kaybolmak için",
        "Caz piyanonun tuşlarında hayat",
        "Güneş batarken her şey daha güzel",
        "Yaprak dökerken ağaçlar da ağlar mı?",
        "Çizim defterim hayallerimle dolu",
        "Bitmemiş romanlar gibi yarım kaldık",
        "Kulaklıklar takılı, dünya uzakta",
        "Bi' fincan huzur, lütfen..."
    ],
    'hip-hop': [
        "Mikrofonu kap, sahneyi yak",
        "Old school ruhuyla new school akışı",
        "Beat'e basınca herkes susar dinler",
        "Rhyme'lar keskin, punchline'lar güçlü",
        "Boom bap ruhu asla ölmez",
        "DJ scratch yapar, MC rap yapar",
        "Graffiti duvarlar, breakdance sokaklar",
        "Hip-hop kültür, yaşam biçimi",
        "Kalem kağıt, karanlık odalar",
        "Cipher'da döneriz, freestyle patlatırız",
        "Altın çağ geçmedi, biz devam ettiriyoruz",
        "Sample'lar ruhun sesi, beat kalbin atışı",
        "Verse'lerde hayat, hook'larda umut",
        "Rap oyunu bu, kuralları biz yazarız",
        "Underground'dan mainstream'e yolculuk",
        "Kökler Bronx'ta, dallar dünyada",
        "Tupac ruhu, Biggie mirası",
        "Her kelime tartılır, her hece önemli",
        "Battle rap, ego savaşı değil sanat",
        "Mikrofon silahım, sözler mermim",
        "Kulak ver, hikayemi dinle",
        "Sokak üniversitesi mezunuyuz",
        "Plak döner, tarih konuşur",
        "Afrika ritmi, Amerikan rüyası",
        "Hip-hop asla ölmez, evrilir sadece",
        "Turntable'da sihirbazlık yaparız",
        "Cypher'da sıra bende, herkes sus",
        "Sneaker kültürü, baggy pantolonlar",
        "90'lar ruhu, 2020'ler sesi",
        "Rap yapmak kolay değil, yaşamak lazım"
    ],
    'r&b': [
        "Mum ışığında dans ederiz",
        "Tenin tenime değdiğinde dünya durur",
        "Gözlerinin içine bakınca eriyorum",
        "Bu gece sadece seninle olmak istiyorum",
        "Slow şarkılar, yavaş dokunuşlar",
        "Kalp kalbe, ruh ruha bağlıyız",
        "Sesin kulaklarımda melodi",
        "Dudakların bal, sözlerin şeker",
        "Seninle her an ayrı güzel",
        "Rüyalarıma bile misafir oluyorsun",
        "Yağmurlu gecelerde seninle olmak",
        "Sıcak bir kucaklama, soğuk dünyada",
        "Ritimle sallanır bedenlerimiz",
        "Aşk dolu geceler, uykusuz sabahlar",
        "Sen benim her şeyimsin",
        "Smooth ses, derin duygular",
        "Falsetto'da aşkı haykırırım",
        "Soul'um seninle dolu",
        "Silhouette'in gözlerimde dans eder",
        "Bi' bakışın bin kelimeden değerli",
        "Parfümün burnumda, yokluğunda bile",
        "Seninle sabaha kadar dans etmek",
        "Gözlerin gökyüzü, kayboluyorum",
        "Bu his tarif edilemez, sadece yaşanır",
        "Ellerini bırakma, bu gece bitmesin",
        "Smooth jazz, şarap ve sen",
        "Bedenler konuşur, kelimeler susar",
        "Seni sevmek en kolay şey dünyada",
        "Vücudumun her hücresi seni istiyor",
        "Bu aşk şarkısı sana yazıldı"
    ],
    'pop': [
        "Hey! Hayat güzel, dans et benimle",
        "Neon ışıklar, gece kulüpleri",
        "Herkes sahne, dünya bize küçük",
        "Trendler değişir, biz kalıcıyız",
        "Catchy melodi, akılda kalır",
        "Summer vibes, sonsuz eğlence",
        "Sosyal medyada viral olduk",
        "Hayatım playlist, her an yeni şarkı",
        "Dancefloor patlar, eller havaya",
        "Gülümse! Fotoğraf çekiyoruz",
        "Party all night, worry tomorrow",
        "Instagram story'de hayatımız",
        "Konfetiler havada, kutlama zamanı",
        "Genç ve özgürüz, durmak yok",
        "Festival sahnesinde binlerce kişi",
        "Hit single, chart-topper",
        "Radio'da döner, herkes söyler",
        "Flashback anılar, güzel günler",
        "Auto-tune ya da değil, his önemli",
        "Dünyayı gezmek, şarkı söylemek",
        "Friday night feeling her gece",
        "Konser ışıkları, çığlıklar",
        "Biz gençliğin sesi, susturamaz kimse",
        "Love song, dance song, party song",
        "Summer hit, kış geçse de çalar",
        "Good vibes only, negatif yasak",
        "DJ bas, biz dans",
        "Club banger, şehir sallanır",
        "Milyar stream, platinum plak",
        "Pop star değil, halkın sesi"
    ],
    'dark trap': [
        "Kabuslarım gerçek oldu, uyanamıyorum",
        "Karanlığın içinde kayboldum",
        "Şeytan kulağıma fısıldar",
        "Geceyi severim, beni gizler",
        "Yalnızlık dostum, acı miras",
        "İç sesim susmak bilmiyor",
        "Ruhum karanlık, kalbim soğuk",
        "Gölgeler peşimde, koşsam da yakalar",
        "Zehirli düşünceler beynimde dans eder",
        "Ay tutulması gibi karanlığa gömüldüm",
        "Cehennemden kartpostal yolluyorum",
        "Ölüm beni korkutmaz, yalnızlık evet",
        "Işığı arıyorum ama bulamıyorum",
        "İçimdeki canavar uyanıyor",
        "Gece üçte en dürüst halimle",
        "Maskeler düşer, gerçek ben ortaya çıkar",
        "Kan ter gözyaşı, hepsi bu yolda",
        "Yaralarım derinleşir, ama ağlamam",
        "Karanlık tarafım kontrol ediyor",
        "Işık olmadan, gölge de yoktur",
        "Paranoya artık normal",
        "Duvarlar kapanıyor etrafımda",
        "Sessiz çığlık, kimse duymaz",
        "Ruhumu sattım başarı için",
        "Kabuslar gündüz de peşimde",
        "Toxic ilişkiler, bağımlılıklar",
        "Aynaya baktım, tanımadım kendimi",
        "Havadan nefes alamıyorum",
        "Depresyon yoldaşım, anksiyete sevgilim",
        "Karanlıktan korkan çocuk büyüdü..."
    ],
    'electronic': [
        "Bass drop, dünya sallanır",
        "Synth dalgaları beynime çarpar",
        "Neon cyberpunk dünyasında",
        "Makineler ve insan bir arada",
        "Dijital aşk, analog kalp",
        "Lazer ışıkları gözlerimi kamaştırır",
        "Gece kulübünde kayboldum",
        "EDM ruhu, trance hissi",
        "Build-up ve drop, adrenalini",
        "VJ'ler görsel şölen sunar",
        "Warehouse party, underground his",
        "PLUR felsefesi, sevgi ve saygı",
        "Kick drum kalbim gibi atar",
        "Hi-hat'ler yağmur gibi yağar",
        "Synth pad'ler uzaya taşır",
        "Arpeggiator'lar dans ettirir",
        "Future bass, geleceğin sesi",
        "Dubstep wobble, beyin titrer",
        "House müzik, ruhumu okşar",
        "Techno gece, durma dans et"
    ]
};

// Kafiye veritabanı - GENİŞLETİLMİŞ
const RHYMES = {
    'ak': ['bak', 'yak', 'sak', 'çak', 'tak', 'kak', 'durak', 'uzak', 'tuzak', 'burak', 'parlak', 'alçak', 'yüksek', 'açık', 'kapalı'],
    'an': ['can', 'san', 'yan', 'ban', 'zaman', 'yalan', 'dolan', 'meydan', 'cihan', 'sultan', 'ozan', 'kazan', 'duman', 'insan'],
    'ar': ['var', 'sar', 'yar', 'kar', 'zarar', 'karar', 'bahar', 'pazar', 'radar', 'avatar', 'yazar', 'çalar', 'sarar', 'yakar'],
    'at': ['kat', 'yat', 'sat', 'mat', 'hayat', 'feryat', 'dikkat', 'surat', 'ahlat', 'sanat', 'adet', 'rahat', 'savaş'],
    'en': ['ben', 'sen', 'den', 'gelen', 'güven', 'seven', 'ölen', 'silen', 'dilen', 'giden', 'bilen', 'duran', 'koşan'],
    'er': ['der', 'yer', 'ver', 'ger', 'haber', 'kader', 'neler', 'güler', 'döner', 'gider', 'sever', 'bekler', 'öper'],
    'ım': ['kalbim', 'ruhum', 'gözüm', 'elim', 'dilim', 'hayalim', 'aklım', 'canım', 'yarım', 'karım', 'param', 'yolum'],
    'in': ['din', 'bin', 'sin', 'kin', 'yığın', 'derin', 'gelin', 'selin', 'zemin', 'kesin', 'emin', 'hemin', 'gizlin'],
    'ir': ['bir', 'kır', 'sır', 'vır', 'kabir', 'fakir', 'şehir', 'nehir', 'zahir', 'mahir', 'sabır', 'hatır', 'geçir'],
    'ol': ['dol', 'sol', 'yol', 'kol', 'kontrol', 'alkol', 'futbol', 'gol', 'idol', 'petrol', 'protokol', 'mol'],
    'or': ['kor', 'sor', 'for', 'zor', 'motor', 'şoför', 'doktor', 'aktör', 'faktör', 'rotor', 'konfor', 'spor'],
    'un': ['dun', 'gun', 'sun', 'onun', 'bunun', 'uğrun', 'kutun', 'tutun', 'uzun', 'oyun', 'duygun', 'koyun'],
    'ur': ['dur', 'kur', 'vur', 'sur', 'umur', 'huzur', 'kondur', 'doldur', 'öldür', 'buldur', 'kaldır', 'yıldır'],
    'üz': ['yüz', 'süz', 'güz', 'tüz', 'öz', 'söz', 'göz', 'dönüz', 'gülüz', 'ölüz', 'deniz', 'sönüz'],
    'iz': ['biz', 'siz', 'diz', 'yalnız', 'hız', 'ız', 'deniz', 'kız', 'iz', 'giz', 'pervaz', 'naz']
};

// Şarkı şablonları - ÖZGÜN VE ŞAŞIRTICI
const SONG_TEMPLATES = {
    trap: [
        { theme: 'yükseliş', lines: [
            "Dipten başladım, zirveyi gördüm şimdi (wow)",
            "Kimse inanmazken ben hep inandım",
            "Cepler boştu dün, bugün dolu kasalar",
            "Hayallerim gerçek, düşmanlar izler sadece"
        ]},
        { theme: 'gece', lines: [
            "Saat 3, sokaklar tenhada (skrrt)",
            "Far ışıkları geceyi yarıyor",
            "Herkes uyurken biz iş üstündeyiz",
            "Gündüz patron, gece kral"
        ]},
        { theme: 'para', lines: [
            "Sayaç dönüyor, hesaplar kabarıyor",
            "Eskiden hayal, şimdi günlük rutin",
            "Marka değil kalite, gösteriş değil güç",
            "Para mutluluk değil ama huzur sağlar"
        ]},
        { theme: 'dostluk', lines: [
            "Kardeşlerimle zirveye, yalnız değiliz",
            "Aynı kandan değil, aynı acıdan geldik",
            "Birinin sırtı her zaman korunur",
            "Gang değil aile, sözde değil özde"
        ]}
    ],
    drill: [
        { theme: 'soğuk', lines: [
            "Yürek buz, bakışlar çelik (gang)",
            "Bu işte duygu yok, sadece mantık",
            "Sessiz geliriz, gürültülü gideriz",
            "Korkak değiliz, tedbirliyiz"
        ]},
        { theme: 'sadakat', lines: [
            "Kardeşim için her şeyi yaparım",
            "Sırtımı sıvazlayan el az",
            "Yollar ayrılsa da kalpler bir",
            "Kan bağı değil, sokak bağı bu"
        ]},
        { theme: 'hayatta kalma', lines: [
            "Her gün bir savaş, her gece bir zafer",
            "Düşmeden yürümek, pes etmeden koşmak",
            "Bu sokaklarda büyüdük, bu sokaklarda kalacağız",
            "Kimse bize acımadı, biz de kimseye acımayız"
        ]}
    ],
    'melodic trap': [
        { theme: 'kayıp aşk', lines: [
            "Telefonunda hâlâ fotoğraflarımız",
            "Sildin mi yoksa ben mi silindim hayatından",
            "Her yağmur damlası senin için ağlar",
            "Gittin de bir parçamı götürdün yanında"
        ]},
        { theme: 'gece düşünceleri', lines: [
            "Saat 3, uyku gelmez gözüme (uyku yok)",
            "Tavanı sayar dururum yıldız gibi",
            "Geceyle dost olduk, gündüz yabancı",
            "Karanlıkta en iyi düşünürüm seni"
        ]},
        { theme: 'özlem', lines: [
            "Mesafelere yenildik, kalplere değil",
            "Sesin kulaklarımda yankılanır",
            "Bir gün dönersin diye hâlâ bekliyorum",
            "Sensiz geçen her saniye bir ömür"
        ]}
    ],
    'lo-fi': [
        { theme: 'huzur', lines: [
            "Cam kenarı, yağmur, bir fincan çay",
            "Dünya dönsün, ben bu köşede mutluyum",
            "Kitap sayfaları arasında kayboldum",
            "Slow motion'da geçiyor hayat"
        ]},
        { theme: 'nostalji', lines: [
            "Eski fotoğraf albümü, sararmış anılar",
            "O günlere dönmek isterdim bazen",
            "Kasette takılı kaldım, CD çağı geçmiş",
            "Retro ruhu modern çağda yaşar"
        ]},
        { theme: 'sabah', lines: [
            "Güneş yavaşça yükselir ufukta",
            "İlk kahve, ilk düşünce, ilk nefes",
            "Yeni gün, yeni umut, yeni başlangıç",
            "Sessizlikte gelen huzuru sevdim"
        ]}
    ]
};

let usedLines = new Set();
let generationHistory = [];

function generateUniqueLyrics(genre, theme = null) {
    let genreKey = genre.toLowerCase().replace(/-/g, ' ').trim();
    
    const genreMap = {
        'dark trap': 'dark trap', 'melodic trap': 'melodic trap', 'melodic': 'melodic trap',
        'lofi': 'lo-fi', 'lo fi': 'lo-fi', 'hip hop': 'hip-hop', 'hiphop': 'hip-hop',
        'rnb': 'r&b', 'r and b': 'r&b'
    };
    
    genreKey = genreMap[genreKey] || genreKey;
    let pool = LYRIC_DB[genreKey] || LYRIC_DB['trap'];
    
    const templates = SONG_TEMPLATES[genreKey];
    if (templates && Math.random() > 0.3) {
        const template = templates[Math.floor(Math.random() * templates.length)];
        if (!generationHistory.includes(template.theme)) {
            generationHistory.push(template.theme);
            if (generationHistory.length > 15) generationHistory.shift();
            return template.lines.join('\n');
        }
    }
    
    let available = pool.filter(line => !usedLines.has(line));
    if (available.length < 4) { usedLines.clear(); available = pool; }
    
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 4);
    selected.forEach(line => usedLines.add(line));
    
    return selected.join('\n');
}

function generateOriginalSong(genre) {
    const subjects = ['Gözlerin', 'Kalbin', 'Ruhun', 'Sözlerin', 'Gecelerin', 'Sokaklar', 'Yıldızlar', 'Hayaller', 'Anılar', 'Melodiler', 'Sessizlik', 'Karanlık', 'Işık', 'Zaman', 'Düşler'];
    const verbs = ['anlatır', 'fısıldar', 'haykırır', 'söyler', 'ağlar', 'güler', 'döner', 'yakar', 'parlar', 'titrer', 'sarar', 'kaçar', 'durur', 'akar', 'koşar'];
    const objects = ['aşkı', 'acıyı', 'özlemi', 'hayatı', 'gerçeği', 'rüyaları', 'umutları', 'korkuları', 'sevinçleri', 'hüzünleri', 'geceyi', 'sabahı', 'yalnızlığı', 'dostluğu'];
    const endings = ['her gece', 'sessizce', 'sonsuza dek', 'bir başına', 'gizlice', 'yürekten', 'derinden', 'içten', 'coşkuyla', 'hüzünle', 'usulca', 'delice', 'çaresizce'];
    
    let lines = [];
    for (let i = 0; i < 4; i++) {
        const s = subjects[Math.floor(Math.random() * subjects.length)];
        const v = verbs[Math.floor(Math.random() * verbs.length)];
        const o = objects[Math.floor(Math.random() * objects.length)];
        const e = endings[Math.floor(Math.random() * endings.length)];
        lines.push(`${s} ${v} ${o} ${e}`);
    }
    return lines.join('\n');
}

const botResponses = {
    'selamlar': [
        `Selam! 👋 Ben FONIX'in yaratıcı asistanıyım!\n\n🎤 **Neler yapabilirim?**\n• "Söz yaz" - Beat'e uygun orijinal sözler\n• "Şarkı oluştur" - Tamamen yeni şarkı\n• "Kafiye bul [kelime]" - Kafiye önerileri\n• "Tema öner" - Yaratıcı temalar\n• "Dertleş" - Sohbet edelim\n\nHadi yaratıcılığını konuştur! 🔥`,
        `Hey! 🎵 FONIX Bot burada!\n\n**Yapabileceklerim:**\n✍️ Şarkı sözü yazma\n🎯 Kafiye bulma\n💡 Tema önerme\n🎤 Freestyle yardımı\n\nBir beat seç ve "yaz" de! 🚀`,
        `Yo! 👊 Stüdyoya hoş geldin!\n\nBen senin **yaratıcı ortağınım**.\nTrap, Drill, Melodic, Lo-fi...\nHepsi bende! Sadece "söz yaz" de! ✨`
    ],
    'aşk': `💕 **Aşk teması için fikirler:**\n\n🌹 **Kavuşamayan Aşk:**\n"Gözlerin aklımda, dokunuşun uzakta"\n\n💔 **Ayrılık:**\n"Gittin de yarım bıraktın her şeyi"\n\n🔥 **Tutkulu Aşk:**\n"Seninle yanarım, sensiz donarım"\n\n"Aşk şarkısı yaz" de!`,
    'kafiye': `📝 **Kafiye Rehberi:**\n\n**-ak/-ek:** Durak, Uzak, Tuzak, Parlak\n**-an/-en:** Zaman, Yalan, Can, Seven\n**-ar/-er:** Karar, Bahar, Kader, Güler\n**-ım/-im:** Kalbim, Ruhum, Gözüm\n\n💡 Son 2 heceye odaklan!`,
    'motivasyon': `🔥 **Motivasyon Temaları:**\n\n💪 **Yükseliş:**\n"Dipten zirveye, imkansızı mümkün kıldık"\n\n🦁 **Güç:**\n"Aslan yürekli, çelik iradeli"\n\n🏆 **Başarı:**\n"Ter dökmeden zafer olmaz"`,
    'hüzün': `😢 **Hüzün Temaları:**\n\n💧 **Yalnızlık:**\n"Kalabalıkta bile yapayalnızım"\n\n🌧️ **Kayıp:**\n"Eksik puzzle parçası gibiyim"\n\n🌙 **Gece:**\n"Saat 3'te en dürüst halimle"`,
    'default': `🤖 Anlayamadım ama yardımcı olayım!\n\n**Dene:**\n• "Söz yaz" / "Şarkı yaz"\n• "Trap/Drill/Melodic söz"\n• "[kelime] kafiye bul"\n• "Tema öner"\n\nYa da ne istediğini anlat! 💪`
};

function askBot(question) {
    addMessage(question, 'user');
    showTyping();
    setTimeout(() => { removeTyping(); addMessage(getBotResponse(question), 'bot'); }, 600 + Math.random() * 600);
}

function sendMessage() {
    if (!chatInput) return;
    const message = chatInput.value.trim();
    if (!message) return;
    chatInput.value = '';
    askBot(message);
}

function addMessage(text, type) {
    if (!chatMessages) return;
    const div = document.createElement('div');
    div.className = `message ${type}`;
    div.innerHTML = text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTyping() {
    if (!chatMessages) return;
    const div = document.createElement('div');
    div.className = 'message bot typing';
    div.id = 'typingIndicator';
    div.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTyping() {
    const t = document.getElementById('typingIndicator');
    if (t) t.remove();
}

function getBotResponse(question) {
    const q = question.toLowerCase().trim();
    
    if (q.match(/^(selam|merhaba|hey|yo|naber|nasılsın|sa|slm)/)) {
        const g = botResponses['selamlar'];
        return g[Math.floor(Math.random() * g.length)];
    }
    
    if (q.includes('yaz') || q.includes('söz') || q.includes('şarkı') || q.includes('tekrar') || q.includes('devam') || q.includes('bir daha')) {
        let genre = currentGenre !== 'default' ? currentGenre : 'trap';
        if (q.includes('trap')) genre = q.includes('dark') ? 'dark trap' : q.includes('melod') ? 'melodic trap' : 'trap';
        if (q.includes('drill')) genre = 'drill';
        if (q.includes('lofi') || q.includes('lo-fi')) genre = 'lo-fi';
        if (q.includes('hip') || q.includes('hop')) genre = 'hip-hop';
        if (q.includes('r&b') || q.includes('rnb')) genre = 'r&b';
        if (q.includes('pop')) genre = 'pop';
        if (q.includes('electronic') || q.includes('edm')) genre = 'electronic';
        
        if (q.includes('orijinal') || q.includes('özel') || q.includes('benzersiz')) {
            return `✨ **Tamamen ORİJİNAL ${genre.toUpperCase()}:**\n\n🎶\n${generateOriginalSong(genre)}\n\nSadece senin için! "Bir daha" de yenisi gelsin! 🔥`;
        }
        
        return `🎵 **${genre.toUpperCase()}** için YENİ sözler:\n\n🎤\n${generateUniqueLyrics(genre)}\n\n${Math.random() > 0.5 ? '🔥 Fire! ' : '✨ '}Beğenmediysen "tekrar" de!`;
    }
    
    if (q.includes('kafiye') || q.includes('uyak')) {
        const words = q.split(' ');
        const target = words.find(w => w.length > 3 && !['kafiye', 'uyak', 'bul', 'için', 'ver', 'öner'].includes(w));
        if (target) {
            const ending = target.slice(-2);
            const rhymes = RHYMES[ending] || [];
            if (rhymes.length > 0) {
                return `📝 **"${target}" için kafiyeler:**\n\n${rhymes.slice(0, 10).map(r => `• ${r}`).join('\n')}\n\n💡 Başka kelime için yaz!`;
            }
        }
        return botResponses['kafiye'];
    }
    
    if (q.includes('aşk') || q.includes('sevgi')) return botResponses['aşk'];
    if (q.includes('motivasyon') || q.includes('gaz') || q.includes('güç')) return botResponses['motivasyon'];
    if (q.includes('hüzün') || q.includes('üzgün')) return botResponses['hüzün'];
    
    if (q.includes('tema') || q.includes('konu') || q.includes('fikir')) {
        const themes = ['🌃 Gece şehri ve neon ışıklar', '💔 İmkansız aşk hikayesi', '🚀 Sıfırdan zirveye yükseliş', '🌧️ Yağmurlu günün melankolisi', '🔥 Sahneyi yakma anı', '🌟 Hayallerin peşinde', '😤 Hater\'lara cevap', '🖤 İç dünyanın karanlığı'];
        return `💡 **Tema Önerileri:**\n\n${themes.sort(() => Math.random() - 0.5).slice(0, 4).join('\n')}\n\nHangisi? O temada yazalım!`;
    }
    
    if (q.includes('yardım') || q.includes('help')) return botResponses['selamlar'][0];
    
    return botResponses['default'];
}

if (chatInput) chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
