export type Language = 'en' | 'sk';
export const copy = {
  en: {
    padInstructions: 'Use the number pad or hardware digits, Backspace to erase, Delete to clear, and Enter to check. You can also choose Use device keyboard.', practiceHelp: 'Practice help',
    useNative: 'Use device keyboard', usePad: 'Use number pad', answerLabel: 'Answer', emptyAnswer: 'empty', numberPad: 'Number pad', backspace: 'Backspace', clearAnswer: 'Clear answer', clear: 'Clear',
    tagline: 'Little steps. Big discoveries.', choose: 'Where shall we explore?', intro: 'Pick your trail. We’ll take it one number at a time.', level: 'Level',
    levels: ['Hello, addition!', 'First steps', 'A little further', 'Big number adventure', 'Equal groups', 'Multiply & share'], details: ['Addition only, up to 10', 'Add & subtract up to 10', 'Add & subtract up to 20', 'Add & subtract up to 100', 'Multiply with 1–5', 'Multiply & divide with 1–10'],
    count: 'How many exercises?', exercises: 'exercises', start: 'Let’s count', gentle: 'No timer. No rush. Just you and your curious mind.', trail: 'Your counting trail', back: 'Choose level', missing: 'Missing number', positions: ['first number', 'second number', 'result'],
    operators: { '+': 'plus', '-': 'minus', '*': 'times', '/': 'divided by' }, equals: 'equals', blank: 'blank', exercise: 'Exercise', of: 'of',
    check: 'Check answer', next: 'Next exercise', finish: 'See how you did', correct: 'That’s it! Nicely done.', incorrect: 'Not quite. Have another try—you can do it.', invalid: 'Check the number.', ready: 'What number belongs in the space?',
    soundOn: 'Sound on', soundOff: 'Sound off', audioUnavailable: 'Sound isn’t available in this browser.', zeroDots: 'No dots', countingSteps: 'Smaller counting steps', hint: 'Hint', showHint: 'Show a hint', nextHint: 'Show next hint', allHints: 'All hints shown', hintStep: 'Hint', tens: 'Tens', ones: 'Ones', unknown: 'Missing amount', originalEquation: 'Completed equation',
    review: 'Review', remaining: 'to practise', reviewTitle: 'Let’s give these another try', reviewHelp: 'These are the ones that needed a little more practice. A correct first try without a hint moves each one off your list.', reviewStart: 'Review tricky ones',
    complete: 'Look how far you’ve come!', finished: 'exercises completed', first: 'First try, without hints', again: 'Play again', summary: 'Every little step helps your brain grow.',
    leaveTitle: 'Leave this trail?', leaveText: 'Your progress in this session will be lost.', stay: 'Keep practising', leave: 'Choose a new trail', confirm: 'Confirm your choice',
  },
  sk: {
    padInstructions: 'Použi číselnú klávesnicu alebo číslice na klávesnici. Backspace vymaže číslicu, Delete celú odpoveď a Enter ju skontroluje. Môžeš zvoliť aj klávesnicu zariadenia.', practiceHelp: 'Pomoc pri počítaní',
    useNative: 'Použiť klávesnicu zariadenia', usePad: 'Použiť číselnú klávesnicu', answerLabel: 'Odpoveď', emptyAnswer: 'prázdna', numberPad: 'Číselná klávesnica', backspace: 'Vymazať poslednú číslicu', clearAnswer: 'Vymazať odpoveď', clear: 'Zmazať',
    tagline: 'Malé kroky. Veľké objavy.', choose: 'Kam sa vyberieme?', intro: 'Vyber si cestu. Budeme počítať krok za krokom.', level: 'Úroveň',
    levels: ['Ahoj, sčítanie!', 'Prvé kroky', 'O kúsok ďalej', 'Veľké číselné dobrodružstvo', 'Rovnaké skupiny', 'Násobíme a delíme'], details: ['Iba sčítanie do 10', 'Sčítanie a odčítanie do 10', 'Sčítanie a odčítanie do 20', 'Sčítanie a odčítanie do 100', 'Násobenie číslami 1–5', 'Násobenie a delenie číslami 1–10'],
    count: 'Koľko príkladov?', exercises: 'príkladov', start: 'Začať počítať', gentle: 'Bez časovača. Bez náhlenia. S chuťou objavovať.', trail: 'Tvoja číselná cesta', back: 'Vybrať úroveň', missing: 'Chýbajúce číslo', positions: ['prvé číslo', 'druhé číslo', 'výsledok'],
    operators: { '+': 'plus', '-': 'mínus', '*': 'krát', '/': 'delené' }, equals: 'rovná sa', blank: 'prázdne miesto', exercise: 'Príklad', of: 'z',
    check: 'Skontrolovať', next: 'Ďalší príklad', finish: 'Pozrieť výsledok', correct: 'Presne tak! Výborne.', incorrect: 'Ešte nie. Skús to znova, zvládneš to.', invalid: 'Skontroluj číslo.', ready: 'Ktoré číslo patrí na prázdne miesto?',
    soundOn: 'Zvuk zapnutý', soundOff: 'Zvuk vypnutý', audioUnavailable: 'Zvuk tu nie je dostupný.', zeroDots: 'Žiadne bodky', countingSteps: 'Menšie kroky počítania', hint: 'Pomôcka', showHint: 'Ukázať pomôcku', nextHint: 'Ďalšia pomôcka', allHints: 'Všetky pomôcky zobrazené', hintStep: 'Pomôcka', tens: 'Desiatky', ones: 'Jednotky', unknown: 'Chýbajúci počet', originalEquation: 'Doplnený príklad',
    review: 'Opakovanie', remaining: 'na precvičenie', reviewTitle: 'Skúsme tieto príklady ešte raz', reviewHelp: 'Tieto príklady si ešte precvičíme. Keď príklad vyriešiš správne na prvý pokus bez pomôcky, už sa nevráti.', reviewStart: 'Precvičiť náročné príklady',
    complete: 'Pozri, čo všetko už dokážeš!', finished: 'vyriešených príkladov', first: 'Na prvý pokus bez pomôcky', again: 'Hrať znova', summary: 'Každý malý krok ti pomáha učiť sa.',
    leaveTitle: 'Opustiť túto cestu?', leaveText: 'Priebeh tohto cvičenia sa neuloží.', stay: 'Pokračovať v počítaní', leave: 'Vybrať novú cestu', confirm: 'Potvrď svoj výber',
  },
} as const;
