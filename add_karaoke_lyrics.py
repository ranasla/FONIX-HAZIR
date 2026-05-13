"""
Karaoke şarkı sözlerini beatlere ekleyen script
"""

from app import app, db, Beat

# Türkçe karaoke şarkı sözleri - her beat için özel sözler
KARAOKE_LYRICS = {
    "Moonlight": """Ay ışığında dans ediyoruz bu gece
Yıldızlar bizim için parlıyor gözleri
Sevdanın rüzgarı esiyor kalbimde
Seninle beraber sonsuza dek

Bu gece sadece sen ve ben varız
Dünya durmuş, zaman donmuş gibi
Ellerin ellerimde sıcacık
Kalbim seninle atıyor her an

Mehtap altında söylüyorum aşkımı
Gözlerinde kaybolmak istiyorum
Sensiz geçen her an bir ömür gibi
Seninle her an bir dünya gibi""",

    "Euphoria": """Özgürüm, uçuyorum gökyüzüne
Hiçbir şey durduramaz beni artık
Kalbim ritmine atıyor dünyanın
Coşku dolu, hayat dolu anlar

Her nefeste yeniden doğuyorum
Her adımda daha da güçlüyüm
Rüzgar saçlarımı savuruyor
Dans ediyorum sevinçle

Bu his tarif edilemez bir mutluluk
Yükseklerden bakıyorum dünyaya
Hiçbir gölge yok kalbimde
Sadece ışık, sadece aşk""",

    "Stargaze": """Yıldızlara bakıyorum her gece
Seni arıyorum uzayın derinliğinde
Bir dilek tutuyorum en parlak yıldıza
Bir gün seni bulmak için

Galaksiler arası yolculuğumuz başlıyor
Işık hızında gidiyoruz rüyalara
Gezegenler dans ediyor etrafımızda
Evren bile bize gülümsüyor

Kuyruklu yıldız gibi geçtin hayatımdan
Ama ışığını bıraktın arkanda
Sonsuza kadar parlamaya devam edecek
Kalbimde senin yıldızın""",

    "Urban Night": """Şehrin ışıkları yanıyor bu gece
Sokaklar canlı, gece uyanık
Neon tabelalar dans ediyor
Ritim sokaklardan yükseliyor

Gece kuşları gibi geziyoruz
Her köşede yeni bir macera var
Club'lar, barlar, hayat dolu
Bu gece bizim gecemiz

Başkent uyanık, biz de öyle
Müzik damarlarımızda akıyor
Sabaha kadar durmak yok
Bu ritme kendimizi bırakıyoruz""",

    "Sunset Vibes": """Güneş batıyor ufukta yavaşça
Turuncu mor renkler gökyüzünde
Denizin üstünde ışıltılar dans ediyor
Bu an sonsuza kadar kalmalı

Sahilde yürüyoruz el ele
Kumlar ayaklarımızın altında sıcak
Martılar şarkı söylüyor bizim için
Günbatımı en güzel hediyemiz

Gece gelmeden bir dilek daha
Bu anları kalbime saklıyorum
Seninle her gün batımı izliyorum
Ve her gün yeniden aşık oluyorum""",

    "Dark Energy": """Gölgeler dans ediyor duvarlarda
Karanlık enerjim yükseliyor
Gecenin derinliklerinden geliyorum
Gücüm sınırsız, ruhum özgür

Bass vuruyor göğsümde
Ritim kanımda akıyor
Kimse durduramaz beni artık
Bu gece tahtıma oturuyorum

Fırtına gibi esiyorum
Yıldırım gibi çakıyorum
Karanlığın içinde ışık oluyorum
Bu benim zamanım""",

    "Chill Waves": """Sakin ol, nefes al yavaşça
Dalgalar usulca sahili öpüyor
Huzurun melodisi çalıyor
Zihin boşalıyor, ruh dinleniyor

Bulutlar gibi hafif hissediyorum
Stres yok, kaygı yok şu an
Sadece an var, sadece şimdi
Bu an için yaşıyorum

Deniz kokusu burnumda
Tuzlu rüzgar yüzümde
Gözlerimi kapatıyorum
Ve huzuru buluyorum""",

    "Hip Hop Flow": """Mikrofonu alıyorum elime
Sözlerim akıyor nehir gibi
Sokaktan gelen bu ses
Kalbimden çıkan bu ritim

Hiç durmadan ileri gidiyorum
Her kelime bir kurşun gibi
Hedefime doğru ateşliyorum
Bu flow durdurulamaz

Beat düşüyor, ben yükseliyorum
Sahneyi sallamaya geldim
Eller havada, kafalar sallanıyor
Bu gece efsane oluyoruz""",

    "Lo-Fi Dreams": """Gece geç saatlerde uyanığım
Piksel piksel rüyalar görüyorum
Nostaljik melodiler çalıyor
Geçmişin güzel anıları

Yağmur cama vuruyor usulca
Kahve kokuyorum masada
Kitap açık, sayfa dönmüyor
Düşüncelere dalıyorum

Eski fotoğraflar gülümsüyor
Zamanda yolculuk yapıyorum
Bu lo-fi anlar
En güzel anlarım""",

    "Electric Soul": """Elektrik damarlarımda akıyor
Ruhum ışık saçıyor
Sentezleyici sesleri yükseliyor
Digital dünyada dans ediyorum

Neon renkleri gözlerimde
Cyberpunk sokaklarında yürüyorum
Gelecek şimdi başlıyor
Ben hazırım

Voltaj yüksek, enerji dolu
Bu gecenin DJ'i benim
Herkes dans pistine
Bırakın ritim sizi alsın""",

    "Jazz Night": """Sigara dumanı ve saksafon sesi
Loş ışıklı jazz kulübündeyiz
Piyano tuşları fısıldıyor
Blues notaları kalplere dokuyor

Trompet ağlıyor bu gece
Kontrabas ritmi tutuyor
Davullar fısıltı gibi
Bu an sihirli

Vintage şarap kadehimde
Gözlerin gözlerimde
Jazz gibi beklenmedik
Aşkımız da öyle""",

    "Summer Anthem": """Yaz geldi, güneş doğdu
Plajda partiye hazırız
Bikiniler, sörf tahtaları
Bu yaz unutulmaz olacak

Barbekü yanıyor, müzik çalıyor
Arkadaşlar burada hepsi
Gülüyoruz, şakalaşıyoruz
Hayat bu kadar güzel

Denize atlıyoruz bir anda
Dalgalarla yarışıyoruz
Bu yaz anıları
Sonsuza kadar kalbimizde""",

    "Trap King": """Tahtıma oturuyorum bu gece
Trap beatleri salladığım yerden
Altın zincirler boynumda
Bu oyunun kralı benim

Hi-hat'ler sağır edecek sizi
808 bass karnınızda hissedeceksiniz
Adblock yok bu müziğe
Trap müzik hayat tarzım

Para yağıyor, başarı geliyor
Hedefe kilitli her zaman
Fake'ler geride kalıyor
Gerçekler önde gidiyor""",

    "Romantic Ballad": """Sana bir şarkı yazıyorum bu gece
Kelimeler yetmiyor anlatmaya
Aşkımız bir şiir gibi
Her satır sana ait

İlk öpücüğümüzü hatırlıyorum
Kalbim hala hızlı çarpıyor
Yıllar geçse de taze kalan
Bir aşk hikayesi bu

Seninle büyüyorum her gün
Seninle güçleniyorum her an
Ölene kadar yanındayım
Bu söz bu şarkıda saklı""",

    "Party Starter": """DJ müziği aç!
Parti başlıyor şimdi!
Eller havada, ayaklar yerde
Dans etmeye hazır mısınız?

Bu gece uyumak yasak
Sabaha kadar dans ediyoruz
Konfetiler düşüyor
Işıklar yanıp sönüyor

Herkes dans pistine
Utanmak yasak bu gece
Kendinizi bırakın müziğe
Parti bizimle güzel!""",

    "Melancholy": """Yağmur yine yağıyor bu gece
Pencereden dışarı bakıyorum
Hüzün bir battaniye gibi
Sarıyor beni usulca

Eski günleri düşünüyorum
Kayıp aşkları, kayıp dostları
Gözyaşları yanaklarımda
Sessizce akıyor

Ama bu hüzün geçici biliyorum
Güneş yarın yine doğacak
Bu gecenin ardından
Yeni bir başlangıç var""",

    "Victory March": """Zafere yürüyoruz hep beraber
Kafalar dik, gözler hedefte
Hiçbir engel durduramaz bizi
Kazanmak için doğduk

Ter döktük, emek verdik
Uykusuz geceler geçirdik  
Şimdi zafer anı geldi
Kupayı kaldırıyoruz

Şampiyonlar burada!
Tarihe adımızı yazıyoruz!
Bu an bizim anımız!
Zafer marşımızı söylüyoruz!""",

    "Dreamy Clouds": """Bulutların üstünde uçuyorum
Pamuk şekerleri gibi yumuşak
Gökkuşağı renkleri etrafımda
Bu düş hiç bitmesin

Melek kanatlarım var sanki
Hafif hafif süzülüyorum
Güneş yüzümü ısıtıyor
Rüya mı gerçek mi bilmiyorum

Uyan diyorlar ama istemiyorum
Bu dünya daha güzel
Bulutların arasında kalayım
Sonsuza kadar""",

    "Freestyle Beat": """Mikrofon açık, beat düşüyor
Sözler aklımdan akıyor
Hazırlık yok, şov var
Freestyle zamanı!

Kelimeler kafiyeli geliyor
Ritim hiç boşluk bırakmıyor
İmprovize bu hayat
Her an yeni bir söz

Sahne benim evim
Mikrofon silahım
Sözlerim mermi
Hedef? Kalpler!""",

    "Outro": """Son notalar çalınıyor usulca
Final yaklaşıyor yavaşça
Bu yolculuk güzeldi
Teşekkürler bu şarkı için

Her şey bir gün bitiyor
Ama anılar yaşıyor
Bu şarkı sizinle olsun
Kalbinizde sonsuza dek

Elveda değil görüşürüz
Yeni şarkılarda buluşuruz
Müzik ölmez yaşar
Biz de onunla birlikte"""
}

def add_lyrics_to_beats():
    """Beatlere karaoke şarkı sözlerini ekle"""
    with app.app_context():
        # Veritabanı tablosunu güncelle (lyrics sütunu yoksa ekle)
        try:
            db.engine.execute('ALTER TABLE beat ADD COLUMN lyrics TEXT')
            print("✅ lyrics sütunu eklendi")
        except:
            print("ℹ️ lyrics sütunu zaten mevcut")
        
        beats = Beat.query.all()
        updated = 0
        
        for beat in beats:
            # Beat adına göre söz bul
            if beat.name in KARAOKE_LYRICS:
                beat.lyrics = KARAOKE_LYRICS[beat.name]
                updated += 1
                print(f"  ✓ {beat.name} - Sözler eklendi")
            else:
                # Varsayılan söz ekle
                beat.lyrics = f"""🎤 {beat.name} 🎤

Bu beat ile serbest söyle!
Mikrofonu al eline
Sözlerini yaz kalbinden
Ritme kendini bırak

{beat.genre} tarzında bu beat
{beat.bpm} BPM hızında akıyor
{beat.mood} modunda hisset
Ve şarkını söyle!

Karaoke gecesi başlıyor
Arkadaşlarınla eğlen
Sesini yükselt  
Bu senin anın!"""
                updated += 1
                print(f"  ✓ {beat.name} - Varsayılan sözler eklendi")
        
        db.session.commit()
        print(f"\n🎉 Toplam {updated} beat güncellendi!")

if __name__ == "__main__":
    add_lyrics_to_beats()
