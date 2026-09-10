# WLED Warehouse — opis rozwiązania i materiał do prezentacji

## 1. W skrócie (elevator pitch)
**WLED Warehouse** to webowy system centralnego zarządzania matrycami LED (panele ESP32 z firmware WLED)
rozmieszczonymi na magazynie. Umożliwia wizualną sygnalizację stanów stref i urządzeń
(np. *wolne* = zielony, *zajęte* = czerwony, ostrzeżenia, logo, komunikaty tekstowe, godzina),
sterowaną zdalnie z poziomu przeglądarki — na komputerze i tablecie/telefonie operatora.

## 2. Problem, który rozwiązuje
Na magazynie trzeba szybko i jednoznacznie komunikować dostępność miejsc do rozkładania towaru,
status urządzeń technicznych i sytuacje alarmowe. Zamiast ręcznego, rozproszonego sterowania
panelami, system daje **jedno miejsce** do:
- zarządzania całą flotą paneli,
- konfigurowania stref i przypisywania do nich paneli,
- udostępniania operatorom prostych, „dotykowych" pulpitów (stan 1 / stan 2 / wył.),
- centralnego wyświetlania grafik, animacji, tekstu i godziny.

## 3. Architektura i wykonanie
- **Frontend:** React 18 + Vite + Tailwind CSS (SPA, responsywny, zoptymalizowany pod dotyk/tablety).
- **Backend:** Node.js + Express; baza **SQLite** (better-sqlite3); autoryzacja **JWT**, hasła **bcrypt**,
  zabezpieczenia `helmet`, limit prób logowania.
- **Integracja z panelami:** backend komunikuje się z WLED po HTTP JSON API
  (`/json/state`, `/json/info`, `/json/eff`, `/json/pal`, presety, piksele `seg[].i` z „freeze").
- **Procesy w tle (serwer):** harmonogram **zegara** (wysyła godzinę na panele) i harmonogram
  **jasności** (ściemnianie wg godzin) — działają niezależnie od otwartej przeglądarki.
- **Wdrożenie:** Docker + docker-compose, sieć **macvlan** (obsługa portu trunk/VLAN 802.1Q),
  pełna konfiguracja przez `.env`, instrukcja migracji (`MIGRATION.md`). Dane trwałe w wolumenie.
- **Kluczowa decyzja architektoniczna:** status i sterowanie panelami idą **przez backend (proxy)**,
  który jest w sieci paneli — dzięki temu operator działa **z dowolnego urządzenia**
  (telefon/tablet/PC), nawet spoza VLAN-u paneli.

## 4. Role i model danych
- **Administrator** — pełna konfiguracja: urządzenia, strefy, użytkownicy, grupy, szablony, grafika,
  harmonogramy, ustawienia, logi.
- **Operator** — widzi **tylko przypisane mu strefy** i steruje nimi z prostego pulpitu.
- **Model:** Strefa (obszar) jest encją nadrzędną → przypisane do niej **panele** i **kafelki**;
  dostęp do strefy nadaje się **użytkownikowi** lub **grupie użytkowników**.

## 5. Pełna funkcjonalność

### Zarządzanie flotą paneli
- **Wyszukiwanie w sieci** (skan podsieci HTTP) — wykrywa panele WLED i pozwala dodać je jednym kliknięciem
  (z auto-wykryciem rozmiaru matrycy); ręczne dodanie po IP z „wykryj".
- Edycja, kopiowanie, **przypisanie panelu do strefy** (lista wyboru, szybka zmiana z karty).
- **Pełne sterowanie WLED** („Steruj"): zasilanie, jasność, kolory, efekty, palety, presety, segmenty.
- **Flota** — przegląd wszystkich paneli ze statusem na żywo, **wyślij tekst** na wszystkie/strefę/panel,
  włącz/wyłącz wszystkie.

### Strefy i dostęp
- Tworzenie stref, przypisywanie paneli, **blokada układu**.
- Nadawanie dostępu pojedynczym użytkownikom lub całym grupom.
- **Użytkownicy i grupy:** zarządzanie kontami, hasłami, rolami; przenoszenie użytkowników do/z grup.

### Pulpit operatora (dotyk)
- Zakładki stref; **kafelki** rozmieszczone na siatce; status paneli na żywo (online / wł / kolor).
- **Tryb „Edytuj układ"** — przesuwanie kafelków na dotyku (strzałki) i myszą (drag&drop),
  układ zapisywany indywidualnie dla operatora.

### Typy kafelków
| Kafelek | Działanie |
|---|---|
| **Włącz/Wyłącz** | przełącza zasilanie paneli |
| **Przełącznik dwustanowy** | cykl: stan 1 → stan 2 → wył.; każdy stan to kolor **lub grafika** |
| **Wskaźnik strefy** | dostępne/niedostępne (zielony/czerwony), klik = wł/wył |
| **Przycisk presetu** | uruchamia preset WLED **lub** wysyła grafikę |
| **Wyświetlacz tekstu** | operator wpisuje tekst + kolor → przewijany na matrycy |
| **Wybór koloru** | operator ustawia jednolity kolor panelu |
| **Zegar** | żywa godzina/data; wysyłka na panel; **auto-wysyłka (cron)** |
| **Grafika** | przycisk wyświetlający zapisaną grafikę/animację |
- Wybór paneli docelowych per kafelek; **wyłączenie tekstu/zegara/grafiki przywraca poprzedni stan**
  panelu (nie gasi go).

### Tekst i zegar
- Tekst przewijany na matrycach 2D (efekt „Scrolling Text", jednolity kolor).
- **Transliteracja polskich znaków** (ZAJĘTE → ZAJETE) — wbudowany font WLED nie ma diakrytyków.
- Zegar z **backendowym cronem** (czas warszawski/TZ), niezależny od przeglądarki.

### Moduł grafiki
- **Edytor pikselowy** dla matryc różnych rozmiarów (16×16, 16×32, 32×16, 8×32…).
- **Animacje** — wiele klatek, regulacja prędkości, zapętlanie, podgląd; odtwarzane przez
  **backendową pętlę** z limitem prędkości (ochrona ESP32).
- **Import obrazka** (PNG/JPG/logo → piksele, dopasowanie z zachowaniem proporcji).
- **Biblioteka ikon** (strzałki, ✓, ✗, ostrzeżenie, kropka — wektorowe, skalowane).
- **Tryb miganie / alarm** (czerwone miganie) jednym kliknięciem.
- Wysyłka grafiki/animacji na wybrane lub wszystkie panele; integracja jako **stan 1/2** przełącznika.

### Harmonogram jasności
- Reguły wg godzin: ustaw jasność / wyłącz / włącz, zakres **wszystkie / strefa**, wybrane dni tygodnia.
- Wykonywane **po stronie serwera** (np. noc → 20%, start zmiany → 100%).

### Szablony konfiguracji
- Przechwycenie „wyglądu" panelu i zastosowanie go na innych panelach/strefach;
  kopiowanie konfiguracji 1:1 z panelu na panele.

### Pozostałe
- **Logi audytu** — wszystkie akcje z filtrem.
- **Ustawienia sieci** (podsieć skanu) + parametry wdrożenia.
- **Migracja** — przenośny, sterowany `.env`; instrukcja dla macvlan/trunk.

## 6. Korzyści biznesowe
- **Szybsza, jednoznaczna komunikacja** statusów na magazynie (mniej pomyłek, krótszy czas reakcji).
- **Prostota dla operatorów** — pulpit „stan 1 / stan 2 / wył.", działa na tabletach.
- **Centralne zarządzanie i bezpieczeństwo** — role, dostęp per strefa, pełny audyt.
- **Elastyczność wizualna** — kolory, tekst, godzina, logo firmy, animacje, alarmy.
- **Niezależność od przeglądarki** — zegar, animacje i harmonogramy działają na serwerze.
- **Łatwe wdrożenie i przenoszenie** między serwerami/sieciami klienta.

## 7. Stos technologiczny (skrót)
React • Vite • Tailwind CSS • Node.js • Express • SQLite • JWT • Docker / docker-compose •
WLED (ESP32) HTTP JSON API • macvlan/VLAN.

---

# Prompt dla AI — wygenerowanie prezentacji

> Skopiuj poniższy prompt do narzędzia AI (np. ChatGPT, Claude, Gemini, Gamma).
> Możesz dokleić sekcje 1–7 powyżej jako materiał źródłowy.

```
Jesteś ekspertem od prezentacji biznesowo-technicznych. Stwórz profesjonalną prezentację
(w języku polskim) o aplikacji „WLED Warehouse" — systemie do centralnego zarządzania
matrycami LED (panele ESP32/WLED) na magazynie.

ODBIORCY (dwie grupy, uwzględnij obie):
1) Przełożeni / kadra zarządzająca — interesują ich korzyści, wartość biznesowa, bezpieczeństwo,
   koszt/wdrożenie, ROI, ryzyka.
2) Zespoły operacyjne, które będą korzystać — interesuje ich prostota obsługi, codzienne scenariusze,
   „jak to działa u mnie".

CEL: przekonać zarząd do wartości rozwiązania i pokazać zespołom, że jest proste w obsłudze.

FORMAT:
- 12–16 slajdów; dla każdego slajdu podaj: TYTUŁ, 3–5 punktów (zwięźle), oraz krótką notatkę dla
  prelegenta (1–2 zdania). Zaproponuj też pomysł na grafikę/ikonę na slajd.
- Ton: konkretny, profesjonalny, bez żargonu tam, gdzie mówimy do zarządu; lekko techniczny
  w częściach dla zespołów.

STRUKTURA (dostosuj, ale zachowaj sens):
1. Slajd tytułowy + jedno zdanie „co to jest".
2. Problem na magazynie (komunikacja stref/urządzeń, ryzyko pomyłek).
3. Rozwiązanie w pigułce (jak adresuje problem).
4. Jak to działa — schemat: panele LED ↔ serwer/aplikacja ↔ przeglądarka operatora.
5. Role: administrator vs operator (kto co widzi i robi).
6. Pulpit operatora — prostota (stan 1 / stan 2 / wył.), działanie na tablecie, przesuwanie kafelków.
7. Typy kafelków i scenariusze użycia (wolne/zajęte, alarm, tekst, godzina, logo, grafika).
8. Moduł grafiki i animacji (edytor, import logo, ikony, miganie/alarm).
9. Automatyzacja (zegar i ściemnianie wg godzin działające na serwerze).
10. Zarządzanie flotą i strefami (wyszukiwanie paneli w sieci, przypisania, grupy użytkowników).
11. Bezpieczeństwo i audyt (role, dostęp per strefa, logi, hasła).
12. Architektura/technologia (skrótowo: React, Node.js, SQLite, Docker, WLED) — slajd dla działu IT.
13. Wdrożenie i przenośność (Docker, konfiguracja przez .env, migracja na serwer klienta).
14. Korzyści biznesowe i wartość (szybsza komunikacja, mniej pomyłek, centralne sterowanie).
15. Plan wdrożenia / następne kroki (pilotaż w jednej strefie → rozszerzenie).
16. Slajd zamykający (podsumowanie + miejsce na pytania).

DODATKOWO:
- Dodaj 1 slajd z przykładowym scenariuszem „dzień z życia operatora".
- Zaproponuj 3 mocne hasła/nagłówki, które można użyć jako tytuł prezentacji.
- Na końcu podaj krótkie „FAQ" (5 pytań i odpowiedzi), które mogą paść od zarządu.

KLUCZOWE FAKTY DO WYKORZYSTANIA (nie pomiń):
- Cel: wizualna sygnalizacja dostępności stref/urządzeń (wolne/zajęte/wyłączone) + komunikaty,
  godzina, logo, alarmy na panelach LED.
- Operatorzy widzą tylko przypisane strefy; obsługa dotykowa (tablety 7–10").
- Administrator: pełna konfiguracja, wyszukiwanie paneli w sieci, strefy, grupy, szablony, grafika,
  harmonogramy, logi.
- Moduł grafiki: edytor pikselowy, animacje z regulacją prędkości i zapętlaniem, import obrazka/logo,
  biblioteka ikon, tryb alarmu/miganie.
- Automaty serwerowe: zegar i ściemnianie wg godzin działają niezależnie od otwartej przeglądarki.
- Technologia: React + Node.js + SQLite, panele ESP32 z WLED, wdrożenie w Dockerze, sieć VLAN/macvlan.
- Bezpieczeństwo: logowanie (JWT, hasła szyfrowane), role admin/operator, dostęp per strefa, pełny audyt.
- Sterowanie panelami przez serwer (proxy) — działa z dowolnego urządzenia w sieci aplikacji.
```
