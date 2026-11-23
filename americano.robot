*** Settings ***
Documentation       Padel Americano: plays a full tournament for 4, 8, 12 and 16 players
...                 with random scores, then verifies results and the schedule rules:
...                 nobody partners the same player twice and everybody meets every
...                 other player exactly twice as an opponent.
Library             SeleniumLibrary
Library             Collections
Library             String
Test Setup          Open Padel App
Test Teardown       Close Browser
Test Template       Play Americano Tournament


*** Variables ***
${BROWSER}              chrome
${APP_FILE}             ${CURDIR}${/}index.html
${TIMEOUT}              5s
${STORAGE_KEY}          americano-app-v1
&{POINTS_TO_PLAY}       4=32    8=32    12=20    16=16

# Locators
${POINTS_INPUT}         id:points
${GENERATE_BUTTON}      xpath://button[@data-action='start']
${NEXT_ROUND_BUTTON}    id:next-round
${START_FINAL_BUTTON}   id:start-final
${END_BUTTON}           id:end-tournament
${CONTINUE_BUTTON}      id:continue
${CLEAR_DATA_BUTTON}    id:clear-storage
${MATCH_ROWS}           //table[contains(@class,'match-table')]/tbody/tr
${STANDINGS_ROWS}       //table[contains(@class,'standings')]/tbody/tr
${ROUND_BLOCKS}         //div[contains(@class,'round-block')]
${TOURNAMENT_NAME}      id:tournament-name
${EDIT_BUTTON}          xpath://header//button[@data-action='edit']
${BACK_BUTTON}          xpath://header//button[@data-action='cancel-edit']
${PAIR_SELECTION}       xpath://button[@data-action='final-order']
${MODE_BUTTONS}         xpath://button[@data-action='mode']
# Pair selection: positions (0 = 1st) of each group of four in the standings that form pair A and pair B.
&{PAIRINGS}             14-23=[[0, 3], [1, 2]]    13-24=[[0, 2], [1, 3]]
@{FINNISH_NAMES}=       Juhani    Mikael    Antti     Ville
...                     Juho      Pekka     Oskari    Eero
...                     Laura     Maria     Anna      Emilia
...                     Sofia     Aino      Sanni     Elina

*** Test Cases ***                                      PLAYERS    FINAL ROUND    EXTRA ROUNDS    NAMES
Americano 4 Players With Final                          4          ${TRUE}
Americano 8 Players With Final                          8          ${TRUE}
Americano 12 Players With Final                         12         ${TRUE}
Americano 16 Players With Final                         16         ${TRUE}
Americano 4 Players Without Final                       4          ${FALSE}
Americano 8 Players Without Final                       8          ${FALSE}
Americano 12 Players Without Final                      12         ${FALSE}
Americano 16 Players Without Final                      16         ${FALSE}
Americano Random Players 3 Extra Rounds With Final      RANDOM     ${TRUE}        3
Americano Random Players 3 Extra Rounds Without Final   RANDOM     ${FALSE}       3
Americano 8 Players Finnish Names With Final            8          ${TRUE}        0               names=${TRUE}
Americano Random Players Finnish Names 3 Extra Rounds   RANDOM     ${TRUE}        3               names=${TRUE}
Americano 8 Players Final 1&3 vs 2&4 With Name          8          ${TRUE}        0               pairing=13-24    tournament=Pääsiäis Padel
Americano Random Players 1&3 vs 2&4 2 Extra Rounds      RANDOM     ${TRUE}        2               pairing=13-24

Mexicano 4 Players With Final
    [Template]    Play Mexicano Tournament
    players=4     play_final=${TRUE}

Mexicano 8 Players With Final
    [Template]    Play Mexicano Tournament
    players=8     play_final=${TRUE}    tournament=Friday Mexicano

Mexicano 12 Players Without Final
    [Template]    Play Mexicano Tournament
    players=12    play_final=${FALSE}

Mexicano 16 Players With Final 1&3 vs 2&4
    [Template]    Play Mexicano Tournament
    players=16    play_final=${TRUE}    pairing=13-24

Mexicano 8 Players 1&3 vs 2&4 Finnish Names
    [Template]    Play Mexicano Tournament
    players=8     play_final=${TRUE}    pairing=13-24    names=${TRUE}    tournament=Torstai Padel

Mexicano Random Players 3 Extra Rounds With Final
    [Template]    Play Mexicano Tournament
    players=RANDOM    play_final=${TRUE}    extra_rounds=3

Americano 12 Demo
    [tags]          demo
    [template]      Play Americano Tournament
    players=12      play_final=${TRUE}    names=${TRUE}


Check Local localStorage
    [tags]          local
    [template]      Check localStorage Content
    players=4       play_final=${TRUE}    names=${TRUE}

Simple localStorage
    [tags]          s
    [template]      Simple localStorage Content
    players=4       play_final=${TRUE}    names=${TRUE}



*** Keywords ***
Play Americano Tournament
    [Documentation]    Full flow for one tournament size. PLAYERS can be RANDOM (4, 8, 12 or 16).
    ...    EXTRA ROUNDS are played after the scheduled rounds with "Continue playing".
    ...    NAMES=${TRUE} enters shuffled names from @{FINNISH_NAMES}; by default the app's
    ...    default names "Player 1" ... "Player N" are used.
    ...    PAIRING is the pair selection of the final round: 14-23 (1 & 4 vs 2 & 3, default)
    ...    or 13-24 (1 & 3 vs 2 & 4). TOURNAMENT is an optional tournament name.
    [Arguments]    ${players}    ${play_final}    ${extra_rounds}=0    ${names}=${FALSE}
    ...    ${pairing}=14-23    ${tournament}=${EMPTY}
    ${extra_rounds}=    Convert To Integer    ${extra_rounds}
    ${players}=    Resolve Players    ${players}
    Log    Players: ${players}, extra rounds: ${extra_rounds}, final round: ${play_final}, names: ${names}, pairing: ${pairing}
    ${rounds}=    Evaluate    ${players} - 1
    ${points}=    Set Up Tournament    americano    ${players}    ${pairing}    ${tournament}    ${names}
    ${score_rows}=    Play Regular Rounds    ${rounds}    ${points}
    IF    ${extra_rounds} > 0
        ${extra_rows}=    Play Extra Rounds    ${rounds}    ${extra_rounds}    ${points}
        ${score_rows}=    Combine Lists    ${score_rows}    ${extra_rows}
    END
    IF    ${play_final}
        # Americano: the pair selection can be changed until the final round is started.
        Verify Edit Tournament Locks    pairing_locked=${FALSE}
        ${final_rows}=    Play Final Round    ${rounds + ${extra_rounds}}    ${points}    ${pairing}
        ${score_rows}=    Combine Lists    ${score_rows}    ${final_rows}
    END
    ${total_rounds}=    Evaluate    ${rounds} + ${extra_rounds} + (1 if ${play_final} else 0)
    ${result_rows}=    Check Results    ${players}    ${points}    ${total_rounds}
    View Details
    ${detail_rows}=    Read Details Table
    Capture Page Screenshot    results-${players}-${play_final}-${extra_rounds}.png
    Log Many    @{score_rows}
    Log Many    @{result_rows}
    #Log Many    @{detail_rows}
    IF    ${rounds} == ${players} - 1
        Verify Players Have Not Partnered Twice    ${detail_rows}    ${players}
    END
    Verify Players Have Met Every Opponent Twice    ${detail_rows}    ${players}
    IF    ${extra_rounds} > 0
        Verify Extra Rounds Repeat Schedule    ${detail_rows}    ${players}    ${extra_rounds}
    END
    Verify Tournament Title    ${tournament}    americano
    # The actual number of players (useful when PLAYERS was RANDOM).
    RETURN    ${players}

Play Mexicano Tournament
    [Documentation]    Mexicano: every round is paired from the current standings with the chosen
    ...    pair selection (PAIRING 14-23 = 1 & 4 vs 2 & 3, 13-24 = 1 & 3 vs 2 & 4); round 1 follows
    ...    the (shuffled) player order. Before the first score of every round the pairings are
    ...    checked against the standings. Arguments as in Play Americano Tournament.
    [Arguments]    ${players}    ${play_final}    ${extra_rounds}=0    ${names}=${FALSE}
    ...    ${pairing}=14-23    ${tournament}=${EMPTY}
    ${extra_rounds}=    Convert To Integer    ${extra_rounds}
    ${players}=    Resolve Players    ${players}
    Log    Mexicano players: ${players}, extra rounds: ${extra_rounds}, final round: ${play_final}, names: ${names}, pairing: ${pairing}
    ${rounds}=    Evaluate    ${players} - 1
    ${points}=    Set Up Tournament    mexicano    ${players}    ${pairing}    ${tournament}    ${names}
    # Mexicano: the pair selection can be changed until the first score is entered.
    Verify Edit Tournament Locks    pairing_locked=${FALSE}
    ${score_rows}=    Play Regular Rounds    ${rounds}    ${points}    ${pairing}
    Verify Edit Tournament Locks    pairing_locked=${TRUE}
    IF    ${extra_rounds} > 0
        ${extra_rows}=    Play Extra Rounds    ${rounds}    ${extra_rounds}    ${points}    ${pairing}
        ${score_rows}=    Combine Lists    ${score_rows}    ${extra_rows}
    END
    IF    ${play_final}
        ${final_rows}=    Play Final Round    ${rounds + ${extra_rounds}}    ${points}    ${pairing}
        ${score_rows}=    Combine Lists    ${score_rows}    ${final_rows}
    END
    ${total_rounds}=    Evaluate    ${rounds} + ${extra_rounds} + (1 if ${play_final} else 0)
    ${result_rows}=    Check Results    ${players}    ${points}    ${total_rounds}
    View Details
    ${detail_rows}=    Read Details Table
    Capture Page Screenshot    mexicano-${players}-${play_final}-${extra_rounds}.png
    Log Many    @{score_rows}
    Log Many    @{result_rows}
    ${blocks}=    Get Element Count    ${ROUND_BLOCKS}
    Should Be Equal As Integers    ${blocks}    ${total_rounds}    msg=Played games do not show every round
    Verify Every Player Plays Once Per Round    ${detail_rows}    ${players}
    Verify Tournament Title    ${tournament}    mexicano
    RETURN    ${players}

Resolve Players
    [Documentation]    RANDOM -> 4, 8, 12 or 16 (written to the test documentation).
    [Arguments]    ${players}
    IF    $players == 'RANDOM'
        ${players}=    Evaluate    str(random.choice([4, 8, 12, 16]))    modules=random
        Set Test Documentation    Randomly selected number of players: ${players}
    END
    RETURN    ${players}

Set Up Tournament
    [Documentation]    Fills the setup page and generates the schedule. Returns the points per match.
    [Arguments]    ${mode}    ${players}    ${pairing}    ${tournament}    ${names}
    Select Playing Mode    ${mode}
    Select Number Of Players    ${players}
    ${points}=    Get From Dictionary    ${POINTS_TO_PLAY}    ${players}
    Select Points To Play    ${points}
    Select Pair Selection    ${pairing}
    IF    $tournament
        Input Text    ${TOURNAMENT_NAME}    ${tournament}
    END
    IF    ${names}
        ${player_names}=    Set Player Names    ${players}
    END
    Generate Schedule
    Verify Tournament Title    ${tournament}    ${mode}
    IF    ${names}
        Verify Player Names    ${player_names}
    END
    RETURN    ${points}

Select Playing Mode
    [Arguments]    ${mode}
    Click Button    xpath://button[@data-action='mode' and @data-mode='${mode}']
    Wait Until Element Is Visible    xpath://button[@data-action='mode' and @data-mode='${mode}' and contains(@class,'active')]

Select Pair Selection
    [Arguments]    ${pairing}
    Click Button    xpath://button[@data-action='final-order' and @data-order='${pairing}']
    Wait Until Element Is Visible    xpath://button[@data-action='final-order' and @data-order='${pairing}' and contains(@class,'active')]

Verify Tournament Title
    [Documentation]    Tournament name and mode badge next to the app name, browser tab title,
    ...    and the red Mexicano theme.
    [Arguments]    ${tournament}    ${mode}
    # The badge is shown in capitals by CSS (text-transform), so compare case-insensitively.
    Element Text Should Be    css:#tournament-title .mode-badge    ${mode}    ignore_case=${TRUE}
    IF    $tournament
        Element Text Should Be    css:#tournament-title .tournament-name    ${tournament}
        Title Should Be    ${tournament} – Padel App
    ELSE
        Page Should Not Contain Element    css:#tournament-title .tournament-name
        Title Should Be    Padel App
    END
    ${red}=    Execute Javascript    return document.body.classList.contains('mode-mexicano');
    Should Be Equal    ${red}    ${{ $mode == 'mexicano' }}    msg=Mexicano theme is wrong for mode ${mode}

Verify Edit Tournament Locks
    [Documentation]    Opens "Edit names": the playing mode is always locked, the pair selection
    ...    only when PAIRING_LOCKED. Returns to the tournament.
    [Arguments]    ${pairing_locked}
    Click Button    ${EDIT_BUTTON}
    Wait Until Page Contains    Edit tournament
    ${buttons}=    Get WebElements    ${MODE_BUTTONS}
    FOR    ${button}    IN    @{buttons}
        Element Should Be Disabled    ${button}
    END
    ${buttons}=    Get WebElements    ${PAIR_SELECTION}
    FOR    ${button}    IN    @{buttons}
        IF    ${pairing_locked}
            Element Should Be Disabled    ${button}
        ELSE
            Element Should Be Enabled    ${button}
        END
    END
    Click Button    ${BACK_BUTTON}
    Wait Until Element Is Visible    ${MATCH_ROWS}

Get Standings Names
    [Documentation]    Player names in standings order.
    ${cells}=    Get WebElements    xpath:${STANDINGS_ROWS}/td[2]
    ${names}=    Create List
    FOR    ${cell}    IN    @{cells}
        ${text}=    Get Text    ${cell}
        Append To List    ${names}    ${text}
    END
    RETURN    ${names}

Verify Pairings Follow Standings
    [Documentation]    Before the first score of a ranked round (Mexicano round or final round):
    ...    court k plays standings group k (places 4k+1 ... 4k+4) with the chosen pair selection.
    [Arguments]    ${pairing}
    ${standings}=    Get Standings Names
    ${positions}=    Evaluate    json.loads($PAIRINGS[$pairing])    modules=json
    ${match_count}=    Get Element Count    ${MATCH_ROWS}
    FOR    ${m}    IN RANGE    ${match_count}
        ${row}=    Set Variable    (${MATCH_ROWS})[${m + 1}]
        ${pair_a}=    Get Pair Names    ${row}/td[contains(@class,'pair')][1]
        ${pair_b}=    Get Pair Names    ${row}/td[contains(@class,'pair')][2]
        ${expected_a}=    Evaluate    [$standings[4 * ${m} + k] for k in $positions[0]]
        ${expected_b}=    Evaluate    [$standings[4 * ${m} + k] for k in $positions[1]]
        Lists Should Be Equal    ${pair_a}    ${expected_a}
        ...    msg=Court ${m + 1} left pair does not follow the standings (${pairing})
        Lists Should Be Equal    ${pair_b}    ${expected_b}
        ...    msg=Court ${m + 1} right pair does not follow the standings (${pairing})
    END
    Log    Pairings follow the standings (${pairing}): ${standings}

Verify Every Player Plays Once Per Round
    [Arguments]    ${detail_rows}    ${players}
    ${round_names}=    Evaluate    sorted({line.split('|')[0] for line in $detail_rows})
    FOR    ${round}    IN    @{round_names}
        ${names}=    Create List
        FOR    ${line}    IN    @{detail_rows}
            @{f}=    Split String    ${line}    |
            IF    $f[0] == $round    Append To List    ${names}    ${f}[2]    ${f}[3]    ${f}[6]    ${f}[7]
        END
        ${unique}=    Evaluate    set($names)
        Length Should Be    ${names}    ${players}    msg=${round}: wrong number of players
        Length Should Be    ${unique}    ${players}    msg=${round}: a player plays more than once
    END

Open Padel App
    ${url}=    Evaluate    pathlib.Path(r'''${APP_FILE}''').as_uri()    modules=pathlib
    Open Browser    ${url}    ${BROWSER}
    #Maximize Browser Window
    Set Window Size     1240     1024
    Set Selenium Timeout    ${TIMEOUT}
    # The app keeps the tournament in localStorage; start every test from the setup page.
    Execute Javascript    window.localStorage.clear();
    Reload Page
    Wait Until Element Is Visible    ${GENERATE_BUTTON}

Select Number Of Players
    [Arguments]    ${players}
    Click Button    xpath://button[@data-action='count' and @data-n='${players}']
    Wait Until Element Is Visible    xpath://button[@data-action='count' and @data-n='${players}' and contains(@class,'active')]

Select Points To Play
    [Arguments]    ${points}
    Input Text    ${POINTS_INPUT}    ${points}
    Textfield Value Should Be    ${POINTS_INPUT}    ${points}

Set Player Names
    [Documentation]    Shuffles @{FINNISH_NAMES} and types the first ${players} names into the
    ...    player fields. Returns the names that were entered.
    [Arguments]    ${players}
    ${shuffled}=    Evaluate    random.sample($FINNISH_NAMES, k=len($FINNISH_NAMES))    modules=random
    ${selected}=    Get Slice From List    ${shuffled}    0    ${players}
    FOR    ${i}    ${name}    IN ENUMERATE    @{selected}
        Input Text    css:input[data-player="${i}"]    ${name}
        Textfield Value Should Be    css:input[data-player="${i}"]    ${name}
    END
    Log Many    Player names:    @{selected}
    RETURN    ${selected}

Verify Player Names
    [Documentation]    The standings list exactly the names that were entered.
    [Arguments]    ${expected}
    ${cells}=    Get WebElements    xpath:${STANDINGS_ROWS}/td[2]
    ${actual}=    Create List
    FOR    ${cell}    IN    @{cells}
        ${text}=    Get Text    ${cell}
        Append To List    ${actual}    ${text}
    END
    Lists Should Be Equal    ${actual}    ${expected}    ignore_order=${TRUE}
    ...    msg=Player names in the tournament differ from the entered names

Generate Schedule
    # Without names=${TRUE} the player fields are left empty, so the app uses "Player 1" ... "Player N".
    Click Button    ${GENERATE_BUTTON}
    Wait Until Element Is Visible    ${MATCH_ROWS}

Play Regular Rounds
    [Documentation]    Fills random scores for every match of every regular round.
    ...    Returns one formatted row per match.
    ...    With PAIRING (Mexicano) the pairings are checked against the standings first.
    [Arguments]    ${rounds}    ${points}    ${pairing}=${NONE}
    ${rows}=    Create List
    FOR    ${r}    IN RANGE    ${rounds}
        IF    $pairing    Verify Pairings Follow Standings    ${pairing}
        ${round_rows}=    Enter Random Scores For Round    ${r}    Round:${r + 1}    ${points}
        Append To List    ${rows}    @{round_rows}
        # The last regular round has "Start final round" / "Continue" instead of "Next round".
        IF    ${r} < ${rounds} - 1
            Click Button    ${NEXT_ROUND_BUTTON}
            Wait Until Page Contains Element    css:input.score[data-r="${r + 1}"]
        END
    END
    RETURN    ${rows}

Play Extra Rounds
    [Documentation]    After the last scheduled round: "Continue playing" starts the first extra
    ...    round, "Next extra round" the following ones. Extra rounds repeat the schedule from round 1.
    [Arguments]    ${rounds}    ${extra_rounds}    ${points}    ${pairing}=${NONE}
    ${rows}=    Create List
    FOR    ${e}    IN RANGE    ${extra_rounds}
        ${round_index}=    Evaluate    ${rounds} + ${e}
        IF    ${e} == 0
            Click Button    ${CONTINUE_BUTTON}
        ELSE
            Click Button    ${NEXT_ROUND_BUTTON}
        END
        Wait Until Page Contains Element    css:input.score[data-r="${round_index}"]
        IF    $pairing    Verify Pairings Follow Standings    ${pairing}
        ${round_rows}=    Enter Random Scores For Round    ${round_index}    Round:${round_index + 1}    ${points}
        Append To List    ${rows}    @{round_rows}
    END
    RETURN    ${rows}

Play Final Round
    [Documentation]    The final is paired from the standings with the chosen PAIRING. Once it has
    ...    started the pair selection is locked (in Mexicano it already is after the first score).
    [Arguments]    ${round_index}    ${points}    ${pairing}=14-23
    Wait Until Element Is Enabled    ${START_FINAL_BUTTON}
    Click Button    ${START_FINAL_BUTTON}
    Wait Until Page Contains Element    css:input.score[data-r="${round_index}"]
    Verify Edit Tournament Locks    pairing_locked=${TRUE}
    Wait Until Page Contains Element    css:input.score[data-r="${round_index}"]
    Verify Pairings Follow Standings    ${pairing}

    ${rows}=    Enter Random Scores For Round    ${round_index}    Round:Final    ${points}
    RETURN    ${rows}

Enter Random Scores For Round
    [Documentation]    Fills a random score for the first pair of each match; the app
    ...    calculates the second pair's score. Logs and returns the formatted rows.
    [Arguments]    ${round_index}    ${label}    ${points}
    ${rows}=    Create List
    ${match_count}=    Get Element Count    ${MATCH_ROWS}
    FOR    ${m}    IN RANGE    ${match_count}
        ${score_a}=    Evaluate    random.randint(0, ${points})    modules=random
        ${input_a}=    Set Variable    css:input.score[data-r="${round_index}"][data-m="${m}"][data-s="a"]
        ${input_b}=    Set Variable    css:input.score[data-r="${round_index}"][data-m="${m}"][data-s="b"]
        Input Text    ${input_a}    ${score_a}
        Commit Score
        ${score_b}=    Get Value    ${input_b}
        ${expected_b}=    Evaluate    ${points} - ${score_a}
        Should Be Equal As Integers    ${score_b}    ${expected_b}
        ...    msg=Second pair score was not calculated automatically
        ${row}=    Set Variable    (${MATCH_ROWS})[${m + 1}]
        ${pair_a}=    Get Pair Names    ${row}/td[contains(@class,'pair')][1]
        ${pair_b}=    Get Pair Names    ${row}/td[contains(@class,'pair')][2]
        ${line}=    Format Match Row    ${label}    ${score_a}    ${pair_a}    ${pair_b}    ${score_b}
        Log    ${line}
        Append To List    ${rows}    ${line}
    END
    # Every completed round lets the tournament be ended.
    Wait Until Element Is Visible    ${END_BUTTON}
    RETURN    ${rows}

Commit Score
    [Documentation]    Leaving a score field makes the app redraw the round. Blur the field and
    ...    wait until the old DOM is gone, so later lookups never hit stale elements.
    # Fallback: if the field had already lost focus, no redraw happens - trigger it with a change event.
    Execute Javascript
    ...    document.querySelectorAll('.round-block').forEach(b => b.setAttribute('data-old', '1'));
    ...    document.activeElement.blur();
    ...    setTimeout(() => { const s = document.querySelector('.round-block[data-old] input.score');
    ...    if (s) s.dispatchEvent(new Event('change', { bubbles: true })); }, 300);
    Wait Until Page Does Not Contain Element    css:.round-block[data-old]

Get Pair Names
    [Documentation]    Returns the two names of a pair cell ("Player 1 & Player 2") as a list.
    [Arguments]    ${locator}
    ${text}=    Get Text    ${locator}
    # The scoring view shows the names on one line or two (one name per line), so split on "&" with any whitespace.
    @{names}=    Evaluate    [n.strip() for n in $text.split('&')]
    RETURN    ${names}

Format Match Row
    [Arguments]    ${label}    ${score_a}    ${pair_a}    ${pair_b}    ${score_b}
    # Format: "Round:1      15  Player 1 / Player 2   -  Player 3 / Player 4    17"
    ${line}=    Catenate    SEPARATOR=
    ...    ${label}    ${SPACE * 6}    ${score_a}    ${SPACE * 2}    ${pair_a}[0] / ${pair_a}[1]
    ...    ${SPACE * 3}-${SPACE * 2}    ${pair_b}[0] / ${pair_b}[1]    ${SPACE * 4}    ${score_b}
    RETURN    ${line}

Check Results
    [Documentation]    Reads the standings, checks the totals and captures a screenshot.
    [Arguments]    ${players}    ${points}    ${total_rounds}
    Wait Until Element Is Visible    ${STANDINGS_ROWS}
    ${count}=    Get Element Count    ${STANDINGS_ROWS}
    Should Be Equal As Integers    ${count}    ${players}
    ${result_rows}=    Create List
    ${total_points}=    Set Variable    ${0}
    FOR    ${i}    IN RANGE    1    ${count + 1}
        ${row}=    Set Variable    (${STANDINGS_ROWS})[${i}]
        ${rank}=    Get Text    ${row}/td[1]
        ${name}=    Get Text    ${row}/td[2]
        ${pts}=    Get Text    ${row}/td[3]
        ${played}=    Get Text    ${row}/td[4]
        ${wdl}=    Get Text    ${row}/td[5]
        ${diff}=    Get Text    ${row}/td[6]
        Should Be Equal As Integers    ${played}    ${total_rounds}
        ...    msg=${name} has not played every round
        ${total_points}=    Evaluate    ${total_points} + ${pts}
        ${line}=    Catenate    ${rank} ${name}    Pts: ${pts}    M: ${played}    W-D-L: ${wdl}    +/-: ${diff}
        Append To List    ${result_rows}    ${line}
    END
    # Every match hands out ${points} points to each of its 4 players' pairs: 2 x points per match.
    ${expected}=    Evaluate    ${total_rounds} * (${players} // 4) * 2 * ${points}
    Should Be Equal As Integers    ${total_points}    ${expected}    msg=Sum of standings points is wrong
    #Capture Page Screenshot    results-${players}-players-{index}.png
    RETURN    ${result_rows}

View Details
    [Documentation]    "End tournament" (shown under every completed round) opens the results
    ...    page with every played game, with or without a final round.
    Wait Until Element Is Visible    ${END_BUTTON}
    Click Button    ${END_BUTTON}
    Wait Until Page Contains    Played games
    #Capture Page Screenshot    details-{index}.png

Read Details Table
    [Documentation]    Reads the games table row by row. Each row is returned as
    ...    "Round|Court|Player A1|Player A2|Score A|Score B|Player B1|Player B2".
    ${details}=    Create List
    ${block_count}=    Get Element Count    ${ROUND_BLOCKS}
    FOR    ${b}    IN RANGE    1    ${block_count + 1}
        ${block}=    Set Variable    (${ROUND_BLOCKS})[${b}]
        ${round}=    Get Text    ${block}//h3
        ${rows}=    Set Variable    ${block}//table[contains(@class,'match-table')]/tbody/tr
        ${row_count}=    Get Element Count    ${rows}
        FOR    ${i}    IN RANGE    1    ${row_count + 1}
            ${row}=    Set Variable    (${rows})[${i}]
            ${court}=    Get Text    ${row}/td[1]
            ${pair_a}=    Get Pair Names    ${row}/td[contains(@class,'pair')][1]
            ${pair_b}=    Get Pair Names    ${row}/td[contains(@class,'pair')][2]
            ${score_a}    ${score_b}=    Get Row Scores    ${row}/td[contains(@class,'scores')]
            ${line}=    Catenate    SEPARATOR=|    ${round}    ${court}    @{pair_a}
            ...    ${score_a}    ${score_b}    @{pair_b}
            Append To List    ${details}    ${line}
        END
    END
    Should Not Be Empty    ${details}
    RETURN    ${details}

Get Row Scores
    [Documentation]    The results page shows the score as text, e.g. "15–17".
    [Arguments]    ${cell}
    ${text}=    Get Text    ${cell}
    ${a}    ${b}=    Split String    ${text}    –
    ${a}=    Strip String    ${a}
    ${b}=    Strip String    ${b}
    RETURN    ${a}    ${b}

Get Round Number
    [Documentation]    "Round 5|..." -> 5, "Final round|..." -> 0.
    [Arguments]    ${line}
    ${number}=    Evaluate    int($line.split('|')[0].split()[1]) if $line.startswith('Round ') else 0
    RETURN    ${number}

Get Regular Round Rows
    [Documentation]    Detail rows of the n-1 scheduled rounds only. The final has its own pairings
    ...    and extra rounds repeat the schedule, so both are left out.
    [Arguments]    ${detail_rows}    ${players}
    ${regular}=    Create List
    FOR    ${line}    IN    @{detail_rows}
        ${number}=    Get Round Number    ${line}
        IF    0 < ${number} < ${players}
            Append To List    ${regular}    ${line}
        END
    END
    RETURN    ${regular}

Get Pairings Of Round
    [Documentation]    Court and players of each match of one round, without the scores.
    [Arguments]    ${detail_rows}    ${round_number}
    ${pairings}=    Create List
    FOR    ${line}    IN    @{detail_rows}
        ${number}=    Get Round Number    ${line}
        IF    ${number} == ${round_number}
            @{f}=    Split String    ${line}    |
            Append To List    ${pairings}    ${f}[1]|${f}[2]|${f}[3]|${f}[6]|${f}[7]
        END
    END
    RETURN    ${pairings}

Verify Extra Rounds Repeat Schedule
    [Documentation]    Extra round k (round n-1+k) must have the same pairings as scheduled round k.
    [Arguments]    ${detail_rows}    ${players}    ${extra_rounds}
    FOR    ${k}    IN RANGE    1    ${extra_rounds + 1}
        ${extra_number}=    Evaluate    ${players} - 1 + ${k}
        ${scheduled}=    Get Pairings Of Round    ${detail_rows}    ${k}
        ${extra}=    Get Pairings Of Round    ${detail_rows}    ${extra_number}
        Should Not Be Empty    ${extra}    msg=Extra round ${extra_number} was not found
        Lists Should Be Equal    ${extra}    ${scheduled}
        ...    msg=Extra round ${extra_number} does not repeat scheduled round ${k}
    END

Pair Key
    [Arguments]    ${p1}    ${p2}
    ${key}=    Evaluate    ' + '.join(sorted([$p1, $p2]))
    RETURN    ${key}

Verify Players Have Not Partnered Twice
    [Arguments]    ${detail_rows}    ${players}
    ${regular}=    Get Regular Round Rows    ${detail_rows}    ${players}
    ${partners}=    Create Dictionary
    FOR    ${line}    IN    @{regular}
        @{f}=    Split String    ${line}    |
        FOR    ${p1}    ${p2}    IN    ${f}[2]    ${f}[3]    ${f}[6]    ${f}[7]
            ${key}=    Pair Key    ${p1}    ${p2}
            Dictionary Should Not Contain Key    ${partners}    ${key}
            ...    msg=Players ${key} have played together twice
            Set To Dictionary    ${partners}    ${key}=1
        END
    END
    # With n-1 rounds every player has partnered every other player exactly once.
    ${expected}=    Evaluate    ${players} * (${players} - 1) // 2
    Length Should Be    ${partners}    ${expected}
    Log Many    Partner pairs (each exactly once):    @{partners.keys()}

Verify Players Have Met Every Opponent Twice
    [Arguments]    ${detail_rows}    ${players}
    ${regular}=    Get Regular Round Rows    ${detail_rows}    ${players}
    ${opponents}=    Create Dictionary
    FOR    ${line}    IN    @{regular}
        @{f}=    Split String    ${line}    |
        FOR    ${a}    IN    ${f}[2]    ${f}[3]
            FOR    ${b}    IN    ${f}[6]    ${f}[7]
                ${key}=    Pair Key    ${a}    ${b}
                ${count}=    Get From Dictionary    ${opponents}    ${key}    default=${0}
                Set To Dictionary    ${opponents}    ${key}=${count + 1}
            END
        END
    END
    ${expected}=    Evaluate    ${players} * (${players} - 1) // 2
    Length Should Be    ${opponents}    ${expected}    msg=Some players never met as opponents
    FOR    ${key}    ${count}    IN    &{opponents}
        Should Be Equal As Integers    ${count}    2    msg=${key} met ${count} times as opponents, expected 2
    END
    Log Many    Opponent pairs (each exactly twice):    @{opponents.keys()}

Check localStorage Content
    [Documentation]     Plays a tournament (same arguments as Play Americano Tournament), then
    ...                 reads the tournament the app saved in the browser's localStorage and 
    ...                 checks its content.
    [Arguments]         ${players}    ${play_final}    ${extra_rounds}=0    ${names}=${FALSE}
    ${extra_rounds}=    Convert To Integer    ${extra_rounds}
    ${players}=         Play Americano Tournament    ${players}    ${play_final}    ${extra_rounds}    names=${names}
    ${raw}=    Execute Javascript    return window.localStorage.getItem('${STORAGE_KEY}');
    Should Not Be Equal    ${raw}    ${None}    msg=No tournament saved in localStorage under '${STORAGE_KEY}'
    ${state}=           Evaluate    json.loads($raw)    modules=json
    ${pretty}=          Evaluate    json.dumps($state, indent=2, ensure_ascii=False)    modules=json
    Log                 ${pretty}

    # Settings and players
    ${points}=    Get From Dictionary    ${POINTS_TO_PLAY}    ${players}
    Should Be Equal As Integers    ${state}[version]    1
    Should Be Equal As Integers    ${state}[n]    ${players}
    Should Be Equal As Integers    ${state}[points]    ${points}
    Should Be True    ${state}[ended]    msg=Tournament is not marked as ended
    Length Should Be    ${state}[players]    ${players}
    IF    ${names}
        List Should Contain Sub List    ${FINNISH_NAMES}    ${state}[players]
        ...    msg=Saved player names are not from FINNISH_NAMES
    ELSE
        ${default_names}=    Evaluate    ['Player %d' % (i + 1) for i in range(${players})]
        Lists Should Be Equal    ${state}[players]    ${default_names}
    END

    # Rounds: n-1 scheduled + extra rounds + optional final
    ${expected_rounds}=    Evaluate    ${players} - 1 + ${extra_rounds} + (1 if ${play_final} else 0)
    Length Should Be    ${state}[rounds]    ${expected_rounds}
    ${kinds}=    Evaluate    [r['kind'] for r in $state['rounds']]
    IF    ${play_final}
        Should Be Equal    ${kinds}[-1]    final    msg=Last saved round is not the final
    ELSE
        List Should Not Contain Value    ${kinds}    final
    END
    ${extra_saved}=    Evaluate    sum(1 for r in $state['rounds'] if r.get('extra'))
    Should Be Equal As Integers    ${extra_saved}    ${extra_rounds}

    # Every match has a score and the two scores add up to the points per match
    ${bad}=    Evaluate    [(ri + 1, mi + 1, m['sa'], m['sb']) for ri, r in enumerate($state['rounds']) for mi, m in enumerate(r['matches'] or []) if m['sa'] is None or m['sb'] is None or m['sa'] + m['sb'] != ${points}]
    Should Be Empty    ${bad}    msg=Saved matches with missing or wrong scores (round, match, sa, sb): ${bad}

    # Clear saved data: confirm the question, then localStorage must be empty
    Click Button    ${CLEAR_DATA_BUTTON}
    ${question}=    Handle Alert    ACCEPT
    Should Start With    ${question}    Are you sure you want to clear the saved data?
    Wait Until Element Is Visible    ${GENERATE_BUTTON}
    ${saved}=    Execute Javascript    return window.localStorage.getItem('${STORAGE_KEY}');
    Should Be Equal    ${saved}    ${None}    msg=Tournament is still saved in localStorage
    ${length}=    Execute Javascript    return window.localStorage.length;
    Should Be Equal As Integers    ${length}    0    msg=localStorage is not empty


Simple localStorage Content
    [Documentation]     Plays a tournament (same arguments as Play Americano Tournament), then
    ...                 reads the tournament the app saved in the browser's localStorage. 

    [Arguments]         ${players}    ${play_final}    ${extra_rounds}=0    ${names}=${FALSE}

    ${extra_rounds}=    Convert To Integer    ${extra_rounds}
    ${players}=         Play Americano Tournament    ${players}    ${play_final}    ${extra_rounds}    names=${names}

    Read localStorage


Read localStorage
    [Documentation]     Read localStorage
    ${raw}=             Execute Javascript    return window.localStorage.getItem('${STORAGE_KEY}');
    Should Not Be Equal    ${raw}    ${None}    msg=No tournament saved in localStorage under '${STORAGE_KEY}'
    ${state}=           Evaluate    json.loads($raw)    modules=json
    ${pretty}=          Evaluate    json.dumps($state, indent=2, ensure_ascii=False)    modules=json
    Log                 ${raw}
    Log                 ${pretty}
