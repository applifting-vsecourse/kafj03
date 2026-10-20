# Moderátorské mazání quacků

## User story

Jako moderátor chci smazat libovolný quack, abych mohl odstranit nevhodný obsah i bez souhlasu jeho autora.

## Akceptační kritéria

1. **Role a oprávnění**
   - Moderátorem je uživatel se stávající rolí `admin`; nová role nevzniká.
   - Admin smí smazat libovolný quack bez ohledu na jeho autora, včetně vlastních quacků a quacků jiných adminů.
   - Běžný uživatel nadále smí mazat pouze vlastní quacky.
   - Roli admina přiděluje a odebírá správce ruční změnou v databázi. Rozhraní ani nové API pro správu rolí nejsou součástí story.
   - Server při každém požadavku na smazání ověří aktuální oprávnění přihlášeného uživatele. Přímé volání API nesmí umožnit obejít kontrolu.
   - Odebrání role admina se projeví při dalším pokusu o smazání cizího quacku i v již přihlášené relaci, bez nutnosti odhlášení. Server takový pokus odmítne a quack nesmaže.

2. **Dostupnost akce a potvrzení**
   - Admin má akci smazání dostupnou přímo v běžném seznamu i detailu každého quacku. Samostatná moderátorská stránka nevzniká.
   - Před smazáním se zobrazí potvrzovací dialog, který jasně sdělí, že smazání je trvalé a zahrnuje případnou anketu a její hlasy.
   - Zrušení dialogu quack zachová; smazání se odešle až po výslovném potvrzení.
   - Během mazání je další odeslání stejné akce zablokované a stav probíhajícího mazání je viditelný.
   - Nové a upravované texty rozhraní jsou v angličtině podle pravidel projektu.

3. **Výsledek smazání**
   - Smazání trvale odstraní celý quack včetně případné ankety, jejích možností a hlasů. Obnova není dostupná.
   - Existující historické metriky používání anket zůstávají zachované podle dosavadních pravidel.
   - Po úspěšném smazání ze seznamu quack zmizí z rozhraní admina.
   - Po úspěšném smazání v detailu se admin vrátí do seznamu se zachováním filtru a hledání.
   - Smazaný quack se při dalším načtení dat nezobrazuje v seznamu ani není dostupný v detailu.
   - Ostatním uživatelům zmizí při dalším načtení dat. Okamžitá synchronizace mazání do ostatních otevřených stránek není součástí story.

4. **Chyby a souběžné smazání**
   - Při chybě mazání zůstane quack zobrazený, rozhraní zobrazí chybovou zprávu a umožní nový pokus.
   - Pokud bylo mazání odmítnuto kvůli odebrané roli, zpráva vysvětlí chybějící oprávnění. Opakování požadavku nesmí obejít aktuální oprávnění.
   - Pokud quack již smazal někdo jiný, rozhraní považuje požadovaný výsledek za dosažený: odstraní quack ze seznamu, případně opustí jeho detail stejně jako při úspěšném smazání.

## Mimo rozsah

- Úpravy cizích quacků, blokování účtů a další moderátorské pravomoci.
- Zadávání nebo ukládání důvodu smazání.
- Nová evidence toho, kdo a kdy quack smazal.
- Upozornění autora na smazání.
- Obnova smazaného obsahu, samostatná moderátorská stránka a správa rolí v aplikaci.

V rozsahu této story nezůstává žádné otevřené produktové rozhodnutí.
