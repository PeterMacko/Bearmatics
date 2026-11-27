import type { Language } from '../i18n';

/** Screenshot names: public/about/<language>/<name>.webp (made by scripts/about-screenshots.mjs). */
export const SHOTS = [
  'course',
  'small-maths',
  'take-away',
  'logic',
  'patterns',
  'english',
  'wordsearch',
  // SCRUM-309: the next-game screen of "Bear picks a game" (in "How a lesson works").
  'bear-picks',
  'summary',
  'app-bar',
  'leaderboard',
] as const;
export type Shot = (typeof SHOTS)[number];

/** Size of every screenshot (390 x 844 phone, portrait). */
export const SHOT_SIZE = { width: 390, height: 844 } as const;

type ShotCopy = { caption: string; alt: string };

/**
 * About page text (SCRUM-218, approved by Peter). Course, level and "What we store" texts are not
 * repeated here: the page takes them from the app's copy (src/i18n.ts), so they stay one source.
 * Level details are the short explanations in brackets after each level name.
 */
export const aboutCopy = {
  en: {
    title: 'About Bearmatics',
    pageTitle: 'About Bearmatics',
    intro:
      'Bearmatics is a free learning app for children aged 5–9, in Slovak and English. A friendly bear guides your child through short lessons in maths, logic and English. It runs in a web browser on phones, tablets, foldable phones and computers – nothing to install, no ads.',
    languages: 'Language / Jazyk',
    play: "Let's play",
    opensFull: '(full size, opens in a new tab)',
    coursesTitle: 'Courses',
    smallLead: 'with pictures for the youngest',
    logicLead: 'think ahead, plan the way and find what comes next',
    logicDetail: 'plan the way with arrows, up to 4 steps',
    logicDetail2: 'stones stand in the way: find the free way, up to 6 steps',
    logicDetail3: 'two pictures take turns: pick the picture that comes next',
    logicDetail4:
      'a row of 2 or 3 pictures with a gap at the end or inside: pick the missing picture',
    logicDetail5:
      'groups that grow or shrink by one, or an arrow that turns a quarter turn: pick what comes next',
    englishLead: '21 school words spoken in a British voice',
    searchLead: 'find the English school words in a grid of letters',
    searchDetails: {
      1: 'the words are listed below the grid; they go left to right or top to bottom',
      2: 'listen to the words, then find them',
      3: 'words also go backwards and diagonally',
    },
    levelDetails: {
      0: 'add up to 6',
      8: 'take pictures out of a basket, up to 6',
      9: 'add two dice, results 7–12',
      1: 'up to 10',
      2: 'add and subtract up to 10',
      3: 'up to 20',
      4: 'up to 20',
      5: 'up to 100',
      6: 'multiply with 1–5',
      7: 'multiply and divide with 1–10',
    },
    lessonTitle: 'How a lesson works',
    lesson: [
      'Choose a level and 5, 10 or 20 exercises.',
      // SCRUM-308: the age badge in the level menus.
      'Every level in the level menu shows a suggested age, for example 5–7. It is only a guide: every level can always be chosen.',
      // SCRUM-309
      'Or let the bear choose: “Bear picks a game” asks your child’s age once (5, 6, 7, 8 or 9+) and then offers one random game for that age after another, never the same game twice in a row. “Choose another” shows a different game; there your child also picks 5, 10 or 20 exercises. Signed in, these lessons give 1.5 times the points, on top of the daily rule below.',
      'Answer with the on-screen number pad or the keyboard. A wrong answer can simply be tried again.',
      'In Maths, hints show the problem in smaller steps.',
      'In Logic, your child plans the bear’s way to the honey with arrows and then presses Go. A short picture demo shows how at the first Logic lesson on a device; Show me plays it again any time.',
      'In Logic levels 3–5, your child looks at a row of pictures and taps the picture that belongs in the “?” place. A wrong picture gets a red mark and another one can be tried. A short picture demo shows how at the first such lesson on a device; Show me plays it again any time.',
      'In Word search, your child taps the first and then the last letter of a word. Each grid hides 5 words; a lesson of 5, 10 or 20 words has 1, 2 or 4 new grids. A word counts on the first try when no wrong pair was tapped before it.',
      'Exercises that needed more tries come back in a short review round.',
      'The summary shows how many were right on the first try without hints.',
      'It also shows how long the lesson took and about how long one exercise took. The time is not saved anywhere.',
      'Mute switches the sounds off; English words are always spoken.',
    ],
    signInTitle: 'Signing in (optional)',
    signIn: [
      'Everything works without an account.',
      'Sign in with Google or a username and password to collect points: 1 point for each exercise right on the first try in a finished lesson.',
      'An easy level played again on one day gives fewer points: from the 3rd play half, from the 5th play a quarter (rounded up). The first play of the day of a harder level (Maths levels 4–7, level 3 of Small maths and English) gives 1.5 times the points. Logic and Word search always give whole points. A small sign in the level menu shows this for the next play: ★, 1/2 or 1/4.',
      'Points grow your bear badge. Play every day to build a streak; missed days freeze it and points can unlock it.',
      'A leaderboard shows nickname, bear, bear badge, streak and points of players; you can hide yourself in the profile.',
      'The profile is only a nickname and a bear your child dresses from parts (fur, background, something for the head, neck and eyes); the bear look is stored as five numbers, no photo or real name. The account can be deleted any time.',
      'Sign out and Delete account first ask a question for a grown-up, so a child cannot press them by mistake.',
    ],
    dataTitle: 'Your data',
    data: [
      'Without an account nothing about your child is stored on our server.',
      'With an account we store only what is needed for points, badge and streak.',
    ],
    dataLast: 'No ads, no selling or sharing of data. Full details:',
    shots: {
      course: {
        caption: 'Choosing a course',
        alt: 'Bearmatics on a phone: the bear, the Bear picks a game button and the five courses Small maths, Logic, Maths, English and Word search.',
      },
      'bear-picks': {
        caption: 'Bear picks a game',
        alt: 'The game the bear picked for a 7-year-old: Maths level 4, Find the missing number, ages 7–9, the star for one and a half times the points and × 1.5, the choice of 5, 10 or 20 exercises and the buttons Play, Choose another, Stop and Change age (7).',
      },
      'small-maths': {
        caption: 'Small maths: count the pictures',
        alt: 'A Small maths exercise: two groups of pictures to add, with the number pad below.',
      },
      'take-away': {
        caption: 'Small maths: take away',
        alt: 'A take-away exercise: pictures in a basket, some of them taken out, and the number pad.',
      },
      logic: {
        caption: 'Logic: guide the bear around the stones to the honey',
        alt: 'A Logic level 2 exercise: a 4 by 4 grid with the bear, a honey pot and two stones, six planned arrows, the arrow buttons and Go.',
      },
      patterns: {
        caption: 'Logic: what comes next?',
        alt: 'A Logic level 3 exercise: a row of two pictures taking turns, a dashed question mark place at the end and three pictures to choose from.',
      },
      english: {
        caption: 'English: listen and choose',
        alt: 'An English listen-and-choose exercise: a speaker button and four word buttons.',
      },
      wordsearch: {
        caption: 'Word search: find the words',
        alt: 'A Word search exercise: a 6 by 6 grid of capital letters with two found words coloured, and the five words below it, two of them struck through.',
      },
      summary: {
        caption: 'Lesson summary',
        alt: 'The end of a lesson: exercises right on the first try without hints, the lesson time, new points and the streak.',
      },
      'app-bar': {
        caption: 'Bear badge, points and streak',
        alt: 'The Maths levels, each with its suggested age; at the top the bear badge with the points and the streak of a test player.',
      },
      leaderboard: {
        caption: 'Leaderboard',
        alt: 'The leaderboard with made-up players and their bear badges: places 1 to 10, two players sharing place 3, then places 12 to 14 with the test player Demo Bear at place 13.',
      },
    } satisfies Record<Shot, ShotCopy>,
  },
  sk: {
    title: 'O aplikácii Bearmatics',
    pageTitle: 'O aplikácii Bearmatics',
    intro:
      'Bearmatics je bezplatná aplikácia na učenie pre deti od 5 do 9 rokov, v slovenčine a angličtine. Priateľský medveď sprevádza dieťa krátkymi lekciami matematiky, logiky a angličtiny. Funguje vo webovom prehliadači na mobile, tablete, skladacom telefóne aj počítači – bez inštalácie a bez reklám.',
    languages: 'Language / Jazyk',
    play: 'Poď hrať',
    opensFull: '(plná veľkosť, otvorí sa na novej karte)',
    coursesTitle: 'Kurzy',
    smallLead: 's obrázkami pre najmenších',
    logicLead: 'mysli dopredu, naplánuj cestu a nájdi, čo príde ďalej',
    logicDetail: 'naplánuj cestu šípkami, najviac 4 kroky',
    logicDetail2: 'v ceste stoja kamene: nájdi voľnú cestu, najviac 6 krokov',
    logicDetail3: 'dva obrázky sa striedajú: vyber obrázok, ktorý príde ďalej',
    logicDetail4:
      'rad 2 alebo 3 obrázkov s medzerou na konci alebo vnútri: vyber obrázok, ktorý chýba',
    logicDetail5:
      'skupiny, ktoré rastú alebo sa zmenšujú o jeden, alebo šípka, ktorá sa otočí o štvrť otáčky: vyber, čo príde ďalej',
    englishLead: '21 slov zo školy v britskej výslovnosti',
    searchLead: 'nájdi anglické slová zo školy v mriežke písmen',
    searchDetails: {
      1: 'slová sú pod mriežkou; idú zľava doprava alebo zhora nadol',
      2: 'vypočuj si slová a potom ich nájdi',
      3: 'slová idú aj odzadu a šikmo',
    },
    levelDetails: {
      0: 'sčítanie s obrázkami do 6',
      8: 'vyber obrázky z košíka, do 6',
      9: 'dve kocky, výsledok 7 až 12',
      1: 'do 10',
      2: 'sčítanie a odčítanie do 10',
      3: 'do 20',
      4: 'do 20',
      5: 'do 100',
      6: 'násobenie číslami 1–5',
      7: 'násobenie a delenie číslami 1–10',
    },
    lessonTitle: 'Ako prebieha lekcia',
    lesson: [
      'Vyber úroveň a 5, 10 alebo 20 príkladov.',
      'Každá úroveň v ponuke úrovní ukazuje odporúčaný vek, napríklad 5–7. Je to len pomôcka: vybrať sa dá vždy každá úroveň.',
      'Alebo nech vyberie medveď: „Medveď vyberie hru“ sa raz opýta na vek dieťaťa (5, 6, 7, 8 alebo 9+) a potom ponúka jednu náhodnú hru pre tento vek za druhou, nikdy nie tú istú dvakrát po sebe. „Vyber inú“ ukáže inú hru; tam si dieťa vyberie aj 5, 10 alebo 20 príkladov. S prihlásením dávajú tieto lekcie 1,5-násobok bodov, navyše k dennému pravidlu nižšie.',
      'Odpoveď napíš číselníkom na obrazovke alebo klávesnicou. Nesprávnu odpoveď môžeš skúsiť znova.',
      'V Matematike pomôcky ukážu príklad v menších krokoch.',
      'V Logike dieťa naplánuje šípkami cestu medveďa k medu a potom stlačí Choď. Krátka obrázková ukážka ukáže ako pri prvej lekcii Logiky na zariadení; tlačidlo Ukáž mi ju kedykoľvek zopakuje.',
      'V Logike na úrovniach 3–5 si dieťa pozrie rad obrázkov a ťukne na obrázok, ktorý patrí na miesto „?“. Nesprávny obrázok dostane červenú značku a dá sa skúsiť iný. Krátka obrázková ukážka ukáže ako pri prvej takej lekcii na zariadení; tlačidlo Ukáž mi ju kedykoľvek zopakuje.',
      'V Osemsmerovke dieťa ťukne na prvé a potom na posledné písmeno slova. V každej mriežke je 5 slov; lekcia s 5, 10 alebo 20 slovami má 1, 2 alebo 4 nové mriežky. Slovo sa počíta na prvý pokus, keď pred ním nebola ťuknutá nesprávna dvojica.',
      'Príklady, ktoré potrebovali viac pokusov, sa vrátia v krátkom opakovaní.',
      'Na konci vidíš, koľko príkladov bolo správne na prvý pokus bez pomôcky.',
      'Uvidíš aj, ako dlho lekcia trvala a koľko asi trval jeden príklad. Čas sa nikam neukladá.',
      'Tlačidlo zvuku vypne zvuky; anglické slová zaznejú vždy.',
    ],
    signInTitle: 'Prihlásenie (nepovinné)',
    signIn: [
      'Všetko funguje aj bez účtu.',
      'Prihlásenie cez Google alebo menom a heslom zbiera body: 1 bod za každý príklad správne na prvý pokus v dokončenej lekcii.',
      'Ľahká úroveň zahraná v jeden deň znova dáva menej bodov: od 3. hry polovicu, od 5. hry štvrtinu (zaokrúhlené nahor). Prvá hra dňa na ťažšej úrovni (Matematika úrovne 4–7, úroveň 3 v Malej matematike a Angličtine) dáva 1,5-násobok bodov. Logika a Osemsmerovka dávajú vždy celé body. Malá značka v ponuke úrovní to ukazuje pre ďalšiu hru: ★, 1/2 alebo 1/4.',
      'Body zväčšujú medvedí odznak. Hraj každý deň a buduj sériu; vynechané dni ju zmrazia a body ju môžu odomknúť.',
      'Rebríček ukazuje prezývku, medveďa, medvedí odznak, sériu a body hráčov; v profile sa môžeš skryť.',
      'Profil je len prezývka a medvedík, ktorého si dieťa oblečie z dielikov (srsť, pozadie, niečo na hlavu, krk a oči); vzhľad medvedíka sa ukladá ako päť čísel, žiadna fotka ani skutočné meno. Účet sa dá kedykoľvek zmazať.',
      'Pri odhlásení a zmazaní účtu sa najprv objaví otázka pre dospelého, aby to dieťa neurobilo omylom.',
    ],
    dataTitle: 'Vaše údaje',
    data: [
      'Bez účtu o dieťati na serveri nič neukladáme.',
      'S účtom ukladáme len to, čo treba pre body, odznak a sériu.',
    ],
    dataLast: 'Žiadne reklamy, údaje nepredávame ani nezdieľame. Podrobnosti:',
    shots: {
      course: {
        caption: 'Výber kurzu',
        alt: 'Bearmatics na mobile: medveď, tlačidlo Medveď vyberie hru a päť kurzov Malá matematika, Logika, Matematika, Angličtina a Osemsmerovka.',
      },
      'bear-picks': {
        caption: 'Medveď vyberie hru',
        alt: 'Hra, ktorú medveď vybral pre 7-ročné dieťa: Matematika, úroveň 4, Hľadáme chýbajúce číslo, vek 7–9, hviezdička za jeden a pol násobok bodov a × 1,5, výber 5, 10 alebo 20 príkladov a tlačidlá Hrať, Vyber inú, Skončiť a Zmeniť vek (7).',
      },
      'small-maths': {
        caption: 'Malá matematika: počítame obrázky',
        alt: 'Príklad z Malej matematiky: dve skupiny obrázkov na sčítanie a pod nimi číselník.',
      },
      'take-away': {
        caption: 'Malá matematika: odoberáme',
        alt: 'Príklad na odoberanie: obrázky v košíku, niektoré vybrané, a číselník.',
      },
      logic: {
        caption: 'Logika: priveď medveďa okolo kameňov k medu',
        alt: 'Príklad z Logiky, úroveň 2: mriežka 4 krát 4 s medveďom, hrncom medu a dvoma kameňmi, šesť naplánovaných šípok, tlačidlá so šípkami a Choď.',
      },
      patterns: {
        caption: 'Logika: čo príde ďalej?',
        alt: 'Príklad z Logiky, úroveň 3: rad dvoch striedajúcich sa obrázkov, na konci prerušovaný rámček s otáznikom a tri obrázky na výber.',
      },
      english: {
        caption: 'Angličtina: počúvaj a vyber',
        alt: 'Úloha z angličtiny Počúvaj a vyber: tlačidlo reproduktora a štyri tlačidlá so slovami.',
      },
      wordsearch: {
        caption: 'Osemsmerovka: nájdi slová',
        alt: 'Úloha z Osemsmerovky: mriežka 6 krát 6 s veľkými písmenami, dve nájdené slová vyfarbené a pod ňou päť slov, dve z nich prečiarknuté.',
      },
      summary: {
        caption: 'Koniec lekcie',
        alt: 'Koniec lekcie: príklady správne na prvý pokus bez pomôcky, čas lekcie, nové body a séria.',
      },
      'app-bar': {
        caption: 'Medvedí odznak, body a séria',
        alt: 'Úrovne Matematiky, každá s odporúčaným vekom; hore medvedí odznak s bodmi a séria testovacieho hráča.',
      },
      leaderboard: {
        caption: 'Rebríček',
        alt: 'Rebríček s vymyslenými hráčmi a ich medvedími odznakmi: miesta 1 až 10, dvaja hráči na spoločnom 3. mieste, potom miesta 12 až 14 s testovacím hráčom Demo Bear na 13. mieste.',
      },
    } satisfies Record<Shot, ShotCopy>,
  },
} satisfies Record<Language, unknown>;

export type AboutCopy = (typeof aboutCopy)[Language];
