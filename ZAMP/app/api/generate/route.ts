import { NextResponse } from 'next/server';

const SONAUTO_API_KEY = process.env.SONAUTO_API_KEY || '';
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || '';

// Artist mapping — must match frontend ARTISTS array exactly
const ARTIST_MAP: Record<string, { real: string; gender: string; style: string }> = {
  "Snoopys Log": { real: "Snoop Dogg", gender: "MALE", style: "LAID-BACK, NASAL, SLURRED WEST COAST DRAWL. RHYTHMIC FLOW." },
  "The Pelvis": { real: "Elvis Presley", gender: "MALE", style: "Rich baritone, rockabilly vibrato, king energy." },
  "Kitten Berry": { real: "Katy Perry", gender: "FEMALE", style: "Pop princess, playful, catchy hooks." },
  "Taylor Swiftly": { real: "Taylor Swift", gender: "FEMALE", style: "Storytelling, pop-country, melodic." },
  "Billie Eyelash": { real: "Billie Eilish", gender: "FEMALE", style: "Haunting, whispery vocals, bass-heavy production." },
  "Eminem&M": { real: "Eminem", gender: "MALE", style: "Fast-paced, aggressive, staccato rapping." },
  "Freddie Thermometer": { real: "Queen", gender: "MALE", style: "Brian May guitar, Freddie Mercury vocals, anthemic rock." },
  "Daft Punk'd": { real: "Daft Punk", gender: "MALE", style: "Robotic vocals, French house, electronic." },
  "Derek Makson": { real: "Michael Jackson", gender: "MALE", style: "Smooth, melodic, incredible runs and falsetto." },
  "Metallica Mittens": { real: "Metallica", gender: "MALE", style: "Heavy metal, distorted guitars, powerful vocals." },
  "DJ Cottage Cheese": { real: "Skrillex", gender: "MALE", style: "Dubstep, heavy bass, electronic production." },
  "Country Bot 3000": { real: "Johnny Cash", gender: "MALE", style: "Deep baritone, country storytelling, raw authenticity." },
  "Jazz Hands Jeff": { real: "Miles Davis", gender: "MALE", style: "Jazz trumpet, smooth improvisation." },
  "Opera Ooze": { real: "Luciano Pavarotti", gender: "MALE", style: "Powerful operatic tenor, dramatic vibrato." },
  "Parody Prince": { real: "Prince", gender: "MALE", style: "Falsetto, funk rock, sexual energy." },
  "Mocking Madonna": { real: "Madonna", gender: "FEMALE", style: "Dance-pop, powerful vocals, catchy." },
  "Satire Sheeran": { real: "Ed Sheeran", gender: "MALE", style: "Acoustic pop, storytelling, warm vocals." },
  "Giggle Gaga": { real: "Lady Gaga", gender: "FEMALE", style: "Powerful belter, theatrical, dance-pop." },
  "Post Malone Alone": { real: "Post Malone", gender: "MALE", style: "Autotuned, melodic, slurred delivery." },
  "The Weekend Warrior": { real: "The Weeknd", gender: "MALE", style: "R&B falsetto, dark atmosphere, smooth." },
  "Dua Flippa": { real: "Dua Lipa", gender: "FEMALE", style: "Dance-pop, sass, disco vibes." },
  "Bruno Mars Bars": { real: "Bruno Mars", gender: "MALE", style: "Multi-instrumentalist, retro pop, powerful voice." },
  "Ariana Grandé-Latte": { real: "Ariana Grande", gender: "FEMALE", style: "Whistle notes, R&B-pop, incredible range." },
  "Drake Snake": { real: "Drake", gender: "MALE", style: "Melodic rap, emotional, Canadian flow." },
  "Cardi B-hive": { real: "Cardi B", gender: "FEMALE", style: "Dominant flow, Bronx energy, hip-hop." },
  "Megan Thee Stal-lion": { real: "Megan Thee Stallion", gender: "FEMALE", style: "Confident, Southern, hip-hop flow." },
  "Nicki Mi-naj": { real: "Nicki Minaj", gender: "FEMALE", style: "Rapid flow, alter egos, hip-hop." },
  "Travis Scott-ish": { real: "Travis Scott", gender: "MALE", style: "Auto-tuned, psychedelic, ad-libs." },
  "21 Sav-age": { real: "21 Savage", gender: "MALE", style: "Trap, deep voice, melodic." },
  "Snoop Dogg-y": { real: "Snoop Dogg", gender: "MALE", style: "LAID-BACK, NASAL, SLURRED WEST COAST DRAWL." },
  "Bob Mar-ley": { real: "Bob Marley", gender: "MALE", style: "Reggae, laid-back, spiritual." },
  "Kurt Cob-ain": { real: "Kurt Cobain", gender: "MALE", style: "Grunge, anguished vocals, raw." },
  "David Bow-tie": { real: "David Bowie", gender: "MALE", style: "Chameleon-like, art-rock, otherworldly." },
  "The Beetles": { real: "The Beatles", gender: "MALE", style: "British invasion, melodic, harmonies." },
  "Elvis Pelvis": { real: "Elvis Presley", gender: "MALE", style: "Rock and roll, hips, powerful." },
  "Michael Jack-son": { real: "Michael Jackson", gender: "MALE", style: "Smooth, incredible runs, pop perfection." },
  "Ed Shearing": { real: "Ed Sheeran", gender: "MALE", style: "Acoustic pop, storytelling, warm vocals." },
  "Kendrick Llama": { real: "Kendrick Lamar", gender: "MALE", style: "Intelligent rap, socially conscious, poetic." },
  "Justin Bee-ber": { real: "Justin Bieber", gender: "MALE", style: "Pop vocals, youthful, catchy." },
  "Selena Go-mez": { real: "Selena Gomez", gender: "FEMALE", style: "Pop vocals, clean production, melodic." },
  "Shawn Men-des": { real: "Shawn Mendes", gender: "MALE", style: "Acoustic pop, sincere vocals, guitar-driven." },
  "Camila Ca-bello": { real: "Camila Cabello", gender: "FEMALE", style: "Latin pop, sensual, powerful vocals." },
  "Harry Styles-ish": { real: "Harry Styles", gender: "MALE", style: "Retro pop rock, charismatic, falsetto." },
  "Miley Cy-rus": { real: "Miley Cyrus", gender: "FEMALE", style: "Powerful belter, rock influences, edgy." },
  "Demi Lo-vato": { real: "Demi Lovato", gender: "FEMALE", style: "Powerful vocals, pop-rock, emotional." },
  "Nick Jonas-brother": { real: "Nick Jonas", gender: "MALE", style: "Pop vocals, falsetto, R&B influences." },
  "Joe Jonas-brother": { real: "Joe Jonas", gender: "MALE", style: "Pop vocals, catchy, youthful energy." },
  "Kevin Jonas-brother": { real: "Kevin Jonas", gender: "MALE", style: "Pop vocals, harmonies, gentle." },
  "Doja Cat-nip": { real: "Doja Cat", gender: "FEMALE", style: "Playful flow, R&B-pop, quirky." },
  "Lil Nas X-ray": { real: "Lil Nas X", gender: "MALE", style: "Country-rap fusion, nasal delivery, viral." },
  "Jack Har-low": { real: "Jack Harlow", gender: "MALE", style: "Southern rap, smooth flow, confident." },
  "DaBa-by": { real: "DaBaby", gender: "MALE", style: "Fast-paced rap, energetic, Charlotte flow." },
  "Lil Ba-by": { real: "Lil Baby", gender: "MALE", style: "Melodic rap, emotional, trap influence." },
  "J. Cole-slaw": { real: "J. Cole", gender: "MALE", style: "Thoughtful rap, introspective, poetic." },
  "Future-istic": { real: "Future", gender: "MALE", style: "Trap, auto-tuned, melancholic." },
  "Young Thug-ger": { real: "Young Thug", gender: "MALE", style: "Avant-garde rap, unique flow, melodic." },
  "Playboi Car-ti": { real: "Playboi Carti", gender: "MALE", style: "Trap, auto-tuned, energetic ad-libs." },
  "Lil Uzi Vert-ical": { real: "Lil Uzi Vert", gender: "MALE", style: "Phonk-influenced, auto-tuned, hyper." },
  "Migos-amigos": { real: "Migos", gender: "MALE", style: "Trap, triplet flow, ad-libs." },
  "Rae Sremm-urd": { real: "Rae Sremmurd", gender: "MALE", style: "Catchy trap, youthful, upbeat." },
  "Swae Lee-way": { real: "Swae Lee", gender: "MALE", style: "Melodic rap, smooth, radio-friendly." },
  "Slim Jxm-mi": { real: "Slim Jxmmi", gender: "MALE", style: "Aggressive flow, Rae Sremmurd duo." },
  "Juice WRLD-wide": { real: "Juice WRLD", gender: "MALE", style: "Emo rap, auto-tuned, emotional." },
  "XXXTen-tacion": { real: "XXXTentacion", gender: "MALE", style: "Emo rap, raw, aggressive." },
  "Lil Peep-hole": { real: "Lil Peep", gender: "MALE", style: "Emo rap, melodic, underground." },
  "Mac Mil-ler": { real: "Mac Miller", gender: "MALE", style: "Conscious rap, jazz-influenced, introspective." },
  "Tyler The Cre-ator": { real: "Tyler, The Creator", gender: "MALE", style: "Odd rap, whimsical, experimental." },
  "Frank Ocean-ic": { real: "Frank Ocean", gender: "MALE", style: "R&B, emotional, falsetto." },
  "A$AP Rock-y": { real: "A$AP Rocky", gender: "MALE", style: "Hustle rap, laid-back, fashion-forward." },
  "Childish Gam-bino": { real: "Childish Gambino", gender: "MALE", style: "Intelligent rap, funk influences, theatrical." },
  "Pharrell Wil-liams": { real: "Pharrell Williams", gender: "MALE", style: "Funk-pop, falsetto, producer." },
  "Kanye West-ern": { real: "Kanye West", gender: "MALE", style: "Auto-tuned rap, production-forward, ambitious." },
  "Jay-Z-ebra": { real: "Jay-Z", gender: "MALE", style: "Business rap, confident, lyrical." },
  "Nas-ty": { real: "Nas", gender: "MALE", style: "Lyrical rap, NY flow, storytelling." },
  "Dr. Dre-idel": { real: "Dr. Dre", gender: "MALE", style: "West Coast rap, smooth, producer." },
  "Ice Cube-icle": { real: "Ice Cube", gender: "MALE", style: "Hardcore rap, aggressive, storytelling." },
  "Eazy-E-rider": { real: "Eazy-E", gender: "MALE", style: "Gangsta rap, raw, N.W.A." },
  "50 Cent-ipede": { real: "50 Cent", gender: "MALE", style: "Hardcore rap, catchy hooks, trauma." },
  "Rihanna-nana": { real: "Rihanna", gender: "FEMALE", style: "R&B-pop, seductive, powerful." },
  "Beyoncé-nce": { real: "Beyoncé", gender: "FEMALE", style: "Powerful vocals, pop-R&B, commanding presence." },
  "Alicia Keys-board": { real: "Alicia Keys", gender: "FEMALE", style: "Soulful piano pop, powerful vocals." },
  "John Leg-end": { real: "John Legend", gender: "MALE", style: "Soulful pop, smooth falsetto, romantic." },
  "Usher-er": { real: "Usher", gender: "MALE", style: "R&B vocals, smooth moves, seductive." },
  "Chris Brown-ie": { real: "Chris Brown", gender: "MALE", style: "R&B vocals, smooth, danceable." },
  "Trey Songz-birds": { real: "Trey Songz", gender: "MALE", style: "R&B vocals, seductive, emotional." },
  "Ne-Yo-yo": { real: "Ne-Yo", gender: "MALE", style: "R&B vocals, smooth, songwriter." },
  "Mario-kart": { real: "Mario", gender: "MALE", style: "R&B vocals, early 2000s, smooth." },
  "Omarion-ette": { real: "Omarion", gender: "MALE", style: "R&B vocals, dance, funky." },
  "Bow Wow-wow": { real: "Bow Wow", gender: "MALE", style: "Rap vocals, youthful, pop-rap." },
  "Soulja Boy-tell-em": { real: "Soulja Boy", gender: "MALE", style: "Rap vocals, dance, crunk influence." },
  "T-Pain-killer": { real: "T-Pain", gender: "MALE", style: "Auto-tuned R&B, catchy, club." },
  "Akon-vict": { real: "Akon", gender: "MALE", style: "Auto-tuned Senegalese pop, crossover." },
  "Sean Paul-bearer": { real: "Sean Paul", gender: "MALE", style: "Dancehall, reggae fusion, energetic." },
  "Shag-gy": { real: "Shaggy", gender: "MALE", style: "Dancehall, comedic, catchy." },
  "Queen Bee": { real: "Beyoncé", gender: "FEMALE", style: "Queen Bee energy, powerful, commanding." },
  "Prince Charming": { real: "Prince", gender: "MALE", style: "Falsetto, funk rock, sexual energy." },
  "Madonna Kebab": { real: "Madonna", gender: "FEMALE", style: "Dance-pop, powerful vocals, catchy." },
  "Nirvan-nah": { real: "Nirvana", gender: "MALE", style: "Grunge, anguished vocals, raw." },
  "Led Zepp-lin": { real: "Led Zeppelin", gender: "MALE", style: "Classic rock, powerful, bluesy." },
  "Pink Floyd-ian": { real: "Pink Floyd", gender: "MALE", style: "Progressive rock, psychedelic, atmospheric." },
  "The Rolling Scones": { real: "The Rolling Stones", gender: "MALE", style: "Rock and roll, bluesy, energetic." },
  "Johnny Cash-Register": { real: "Johnny Cash", gender: "MALE", style: "Deep baritone, country storytelling, raw authenticity." },
  "Frank Sin-atra": { real: "Frank Sinatra", gender: "MALE", style: "Classic pop, smooth crooner, standards." },
  "Bob Dylan-dog": { real: "Bob Dylan", gender: "MALE", style: "Folk-rock, nasal, poetic." },
  "Jimi Hen-drix": { real: "Jimi Hendrix", gender: "MALE", style: "Psychedelic rock, guitar god, visionary." },
  "The Who-owl": { real: "The Who", gender: "MALE", style: "Rock opera, powerful, anthemic." },
  "The Doors-knobs": { real: "The Doors", gender: "MALE", style: "Psychedelic rock, mysterious, Jim Morrison." },
  "Fleetwood Mac-n-Cheese": { real: "Fleetwood Mac", gender: "MALE", style: "Classic rock, harmonies, smooth." },
  "Aerosmith-ereens": { real: "Aerosmith", gender: "MALE", style: "Hard rock, bluesy, powerful." },
  "AC/DC-Adapter": { real: "AC/DC", gender: "MALE", style: "Hard rock, high energy, riff-driven." },
  "Guns N' Roses-bushes": { real: "Guns N' Roses", gender: "MALE", style: "Hard rock, aggressive, iconic." },
  "Bruce Spring-steen": { real: "Bruce Springsteen", gender: "MALE", style: "Heartland rock, storytelling, working class." },
  "Elton John-Deere": { real: "Elton John", gender: "MALE", style: "Piano pop, flamboyant, powerful vocals." },
  "Stevie Wonder-bread": { real: "Stevie Wonder", gender: "MALE", style: "Soul, harmonica virtuoso, melodic." },
  "Marvin Gaye-lord": { real: "Marvin Gaye", gender: "MALE", style: "Soul, sensual, socially conscious." },
  "Aretha Frank-lin": { real: "Aretha Franklin", gender: "FEMALE", style: "Queen of Soul, powerful, gospel roots." },
  "James Brown-ie": { real: "James Brown", gender: "MALE", style: "Godfather of Soul, raw energy, funk." },
  "Ray Charles-ton": { real: "Ray Charles", gender: "MALE", style: "Soul pioneer, piano, smooth." },
  "Chuck Berry-pie": { real: "Chuck Berry", gender: "MALE", style: "Rock and roll pioneer, guitar-driven." },
  "Little Richard-son": { real: "Little Richard", gender: "MALE", style: "Rock and roll, flamboyant, high energy." },
  "Buddy Holly-wood": { real: "Buddy Holly", gender: "MALE", style: "Early rock and roll, wholesome, melodic." },
  "Jerry Lee Lewis-iana": { real: "Jerry Lee Lewis", gender: "MALE", style: "Rock and roll, piano, wildman." },
  "Fats Domino-pizza": { real: "Fats Domino", gender: "MALE", style: "New Orleans R&B, smooth, piano-driven." },
  "Bo Diddley-squat": { real: "Bo Diddley", gender: "MALE", style: "Rock and roll, rhythm distinctive, raw." },
  "Muddy Waters-slide": { real: "Muddy Waters", gender: "MALE", style: "Delta blues, slide guitar, raw." },
  "B.B. King-kong": { real: "B.B. King", gender: "MALE", style: "Blues guitar, smooth vocals, expressive." },
  "John Lee Hooker-rug": { real: "John Lee Hooker", gender: "MALE", style: "Blues, hypnotic, raw." },
  "Howlin' Wolf-man": { real: "Howlin' Wolf", gender: "MALE", style: "Blues, powerful, menacing." },
  "Etta James-bond": { real: "Etta James", gender: "FEMALE", style: "Soul, powerful, gutbucket." },
  "Billie Holi-day": { real: "Billie Holiday", gender: "FEMALE", style: "Jazz vocals, melancholic, iconic." },
  "Ella Fitz-gerald": { real: "Ella Fitzgerald", gender: "FEMALE", style: "Jazz vocals, scat, flawless technique." },
  "Louis Arm-strong": { real: "Louis Armstrong", gender: "MALE", style: "Jazz trumpet, gravelly vocals, charismatic." },
  "Duke Elling-ton": { real: "Duke Ellington", gender: "MALE", style: "Jazz big band, sophisticated, orchestral." },
  "Count Basi-c": { real: "Count Basie", gender: "MALE", style: "Jazz big band, swing, piano-driven." },
  "Miles Davis-cup": { real: "Miles Davis", gender: "MALE", style: "Jazz trumpet, cool, innovative." },
  "John Col-trane": { real: "John Coltrane", gender: "MALE", style: "Jazz saxophone, avant-garde, spiritual." },
  "Charlie Par-ker": { real: "Charlie Parker", gender: "MALE", style: "Jazz saxophone, bebop, virtuoso." },
  "Thelonious Monk-ey": { real: "Thelonious Monk", gender: "MALE", style: "Jazz piano, angular, unique." },
  "Dizzy Gilles-pie": { real: "Dizzy Gillespie", gender: "MALE", style: "Jazz trumpet, bebop, virtuoso." },
  "Charles Min-gus": { real: "Charles Mingus", gender: "MALE", style: "Jazz bass, composer, innovative." },
  "Buddy Rich-ard": { real: "Buddy Rich", gender: "MALE", style: "Jazz drums, virtuoso, technical." },
  "Gene Kru-pa": { real: "Gene Krupa", gender: "MALE", style: "Jazz drums, big band, energetic." },
  "Benny Good-man": { real: "Benny Goodman", gender: "MALE", style: "Jazz clarinet, swing, King of Swing." },
  "Glenn Mil-ler": { real: "Glenn Miller", gender: "MALE", style: "Jazz big band, swing, smooth." },
  "Harry James-on": { real: "Harry James", gender: "MALE", style: "Jazz trumpet, big band, powerful." },
  "Bing Cros-by": { real: "Bing Crosby", gender: "MALE", style: "Crooner, smooth, classic pop." },
  "Nat King Cole-slaw": { real: "Nat King Cole", gender: "MALE", style: "Crooner, smooth piano, velvet voice." },
  "Dean Mar-tin": { real: "Dean Martin", gender: "MALE", style: "Crooner, smooth, Italian charm." },
  "Sammy Davis Jr-mint": { real: "Sammy Davis Jr", gender: "MALE", style: "Entertainer, smooth, Rat Pack." },
  "Tony Ben-nett": { real: "Tony Bennett", gender: "MALE", style: "Crooner, jazz standards, elegant." },
  "Frankie Ava-lon": { real: "Frankie Avalon", gender: "MALE", style: "Pop crooner, teen idol, smooth." },
  "Bobby Dar-in": { real: "Bobby Darin", gender: "MALE", style: "Swashbuckling, smooth, multi-genre." },
  "Ricky Nel-son": { real: "Ricky Nelson", gender: "MALE", style: "Teen idol, rock and roll, wholesome." },
  "The Everly Broth-ers": { real: "The Everly Brothers", gender: "MALE", style: "Harmony duo, rock and roll, sweet." },
  "Roy Orbi-son": { real: "Roy Orbison", gender: "MALE", style: "Ballads, dramatic, operatic voice." },
  "Carl Per-kins": { real: "Carl Perkins", gender: "MALE", style: "Rock and roll, Sun Records, bluesy." },
  "Gene Vin-cent": { real: "Gene Vincent", gender: "MALE", style: "Rock and roll, wild, BE-BOP-A-LULA." },
  "Eddie Coch-ran": { real: "Eddie Cochran", gender: "MALE", style: "Rock and roll, guitar-driven, rebellious." },
  "Ritchie Val-ens": { real: "Ritchie Valens", gender: "MALE", style: "Rock and roll, Latin influence, sweet." },
  "Del Shan-non": { real: "Del Shannon", gender: "MALE", style: "Rock and roll, falsetto, pop." },
  "Chubby Check-er": { real: "Chubby Checker", gender: "MALE", style: "R&B, twist, danceable." },
  "Fats Wall-er": { real: "Fats Waller", gender: "MALE", style: "Jazz piano, boogie-woogie, witty." },
  "Sam Cooke-ie": { real: "Sam Cooke", gender: "MALE", style: "Soul, smooth, gospel roots." },
  "Otis Red-ding": { real: "Otis Redding", gender: "MALE", style: "Soul, raw emotion, powerful." },
  "Wilson Pick-ett": { real: "Wilson Pickett", gender: "MALE", style: "Soul, energetic, raw." },
  "Solomon Burke-ley": { real: "Solomon Burke", gender: "MALE", style: "Soul, gospel-influenced, King of Soul." },
  "Percy Sledge-hammer": { real: "Percy Sledge", gender: "MALE", style: "Soul ballads, emotional, When a Man Loves a Woman." },
  "Joe Tex-as": { real: "Joe Tex", gender: "MALE", style: "Soul, humorous, danceable." },
  "Ziggy Mar-ley": { real: "Ziggy Marley", gender: "MALE", style: "Reggae, playful, Bob's son." },
  "Damian Mar-ley": { real: "Damian Marley", gender: "MALE", style: "Reggae, modern, Bob's son." },
  "Ky-Mani Mar-ley": { real: "Ky-Mani Marley", gender: "MALE", style: "Reggae, acoustic, roots." },
  "Rita Mar-ley": { real: "Rita Marley", gender: "FEMALE", style: "Reggae, soulful, Bob's wife." },
  "Lauryn Hill-side": { real: "Lauryn Hill", gender: "FEMALE", style: "Neo-soul, conscious rap, powerful." },
  "Wyclef Jean-jacket": { real: "Wyclef Jean", gender: "MALE", style: "Hip-hop, Fugees, Caribbean." },
  "Pras Mi-chel": { real: "Pras Michel", gender: "MALE", style: "Hip-hop, Fugees, multilingual." },
  "Outkast-aways": { real: "OutKast", gender: "MALE", style: "Southern hip-hop, eclectic, Andre 3000 & Big Boi." },
  "Andre 3000-lbs": { real: "Andre 3000", gender: "MALE", style: "Southern hip-hop, artistic, lyrical." },
  "Big Boi-ardee": { real: "Big Boi", gender: "MALE", style: "Southern hip-hop, versatile, OutKast." },
  "Wu-Tang Clan-destine": { real: "Wu-Tang Clan", gender: "MALE", style: "East Coast hip-hop, hard, kung fu samples." },
  "RZA-razor": { real: "RZA", gender: "MALE", style: "Wu-Tang founder, producer, gravelly." },
  "GZA-gizzard": { real: "GZA", gender: "MALE", style: "Wu-Tang, lyrical, methodical." },
  "Method Man-nequin": { real: "Method Man", gender: "MALE", style: "Wu-Tang, deep voice, catchy." },
  "Ghostface Kill-ah": { real: "Ghostface Killah", gender: "MALE", style: "Wu-Tang, dramatic, verbose." },
  "Raekwon-do": { real: "Raekwon", gender: "MALE", style: "Wu-Tang, storytelling, vivid." },
  "U-God-zilla": { real: "U-God", gender: "MALE", style: "Wu-Tang, deep voice, raw." },
  "Goodie Mob-ster": { real: "Goodie Mob", gender: "MALE", style: "Southern hip-hop, conscious, Dungeon Family." },
  "CeeLo Green-ery": { real: "CeeLo Green", gender: "MALE", style: "Soulful, quirky, Goodie Mob/Gnarls Barkley." },
  "Danger Mouse-trap": { real: "Danger Mouse", gender: "MALE", style: "Producer, Gnarls Barkley, innovative." },
  "MF DOOM-SDAY": { real: "MF DOOM", gender: "MALE", style: "Underground hip-hop, mask, complex." },
  "Inspectah Deck-chair": { real: "Inspectah Deck", gender: "MALE", style: "Wu-Tang, versatile, underrated." },
  "Clyde McPhat-ter": { real: "Clyde McPhatter", gender: "MALE", style: "R&B, high voice, early soul." },
  "Jackie Wil-son": { real: "Jackie Wilson", gender: "MALE", style: "Soul, high energy, dynamic." },
  "Cab Cal-loway": { real: "Cab Calloway", gender: "MALE", style: "Jazz, big band, hi-de-ho." },
  "Louis Jor-dan": { real: "Louis Jordan", gender: "MALE", style: "R&B, jump blues, sax-driven." },
  "Big Joe Turn-er": { real: "Big Joe Turner", gender: "MALE", style: "Blues, rock and roll pioneer, boogie." },
  "Ruth Brown-ie": { real: "Ruth Brown", gender: "FEMALE", style: "R&B, powerful, Atlantic Records." },
  "LaVern Bak-er": { real: "LaVern Baker", gender: "FEMALE", style: "R&B, playful, Soul train." },
  "Gnarls Bark-ley": { real: "Gnarls Barkley", gender: "MALE", style: "Soul, quirky, innovative, crazy sexiness." },
  "Tommy Dor-sey": { real: "Tommy Dorsey", gender: "MALE", style: "Jazz trombone, smooth, big band." },
  "Cold-play-doh": { real: "Coldplay", gender: "MALE", style: "Anthemic alternative rock, soaring falsetto, piano-driven emotion." },
  "Imagine Drag-ons": { real: "Imagine Dragons", gender: "MALE", style: "Arena rock, powerful drums, anthemic choruses." },
  "Maroon 5-Alive": { real: "Maroon 5", gender: "MALE", style: "Funky pop rock, smooth falsetto, radio-friendly." },
  "One Direc-tion": { real: "One Direction", gender: "MALE", style: "Boy band pop, harmonies, youthful energy." },
  "Linkin Park-ing": { real: "Linkin Park", gender: "MALE", style: "Nu metal rap rock, emotional, hybrid theory energy." },
  "Green Day-light": { real: "Green Day", gender: "MALE", style: "Punk rock, fast power chords, snotty vocals." },
  "Red Hot Chili Pepp-er": { real: "Red Hot Chili Peppers", gender: "MALE", style: "Funk rock, slap bass, Anthony Kiedis rap-singing." },
  "Oasis-sis": { real: "Oasis", gender: "MALE", style: "Britpop, Liam Gallagher nasal snarl, Noel melodies." },
  "Radio-head-ache": { real: "Radiohead", gender: "MALE", style: "Alternative rock, Thom Yorke falsetto, experimental." },
  "Pearl Jam-boree": { real: "Pearl Jam", gender: "MALE", style: "Grunge, Eddie Vedder baritone, earnest intensity." },
  "Foo Fight-ers": { real: "Foo Fighters", gender: "MALE", style: "Arena rock, Dave Grohl raw vocals, powerful drums." },
  "The Kill-ers": { real: "The Killers", gender: "MALE", style: "New wave rock, Brandon Flowers dramatic tenor, synths." },
  "Panic! At The Disco-ball": { real: "Panic! At The Disco", gender: "MALE", style: "Theatrical pop rock, Brendon Urie soaring vocals." },
  "Fall Out Boy-band": { real: "Fall Out Boy", gender: "MALE", style: "Pop punk, Patrick Stump high tenor, wordplay lyrics." },
  "My Chemi-cal Romance": { real: "My Chemical Romance", gender: "MALE", style: "Emo rock, Gerard Way dramatic delivery, anthemic." },
  "Twenty One Pilot-s": { real: "Twenty One Pilots", gender: "MALE", style: "Genre-blending, Tyler Joseph rap-singing, emotional." },
  "Paramore-ange": { real: "Paramore", gender: "FEMALE", style: "Pop punk, Hayley Williams powerful belter, energetic." },
  "Evanes-cents": { real: "Evanescence", gender: "FEMALE", style: "Gothic rock, Amy Lee ethereal operatic vocals, dark." },
  "System Of A Down-town": { real: "System of a Down", gender: "MALE", style: "Nu metal, Serj Tankian unhinged vocals, political." },
  "Slip-knot": { real: "Slipknot", gender: "MALE", style: "Heavy metal, Corey Taylor aggressive growls, chaotic." },
  "Metalli-ca": { real: "Metallica", gender: "MALE", style: "Thrash metal, James Hetfield rhythmic barking, heavy." },
  "Iron Maid-en": { real: "Iron Maiden", gender: "MALE", style: "Heavy metal, Bruce Dickinson operatic wail, galloping." },
  "Black Sab-bath": { real: "Black Sabbath", gender: "MALE", style: "Doom metal, Ozzy Osbourne haunting wail, dark riffs." },
  "Deep Pur-ple": { real: "Deep Purple", gender: "MALE", style: "Hard rock, Ian Gillan powerful screams, organ-driven." },
  "Journey-man": { real: "Journey", gender: "MALE", style: "Arena rock, Steve Perry soaring tenor, anthemic power ballads." },
  "Bon Jovi-al": { real: "Bon Jovi", gender: "MALE", style: "Hair metal, Jon Bon Jovi raspy tenor, big choruses." },
  "Def Lepp-ard": { real: "Def Leppard", gender: "MALE", style: "Glam metal, Joe Elliott rasp, layered harmonies." },
  "Whitney Houston-we": { real: "Whitney Houston", gender: "FEMALE", style: "Powerhouse pop-R&B, incredible range, gospel roots." },
  "Celine Dion-saur": { real: "Celine Dion", gender: "FEMALE", style: "Power ballads, soaring crystalline vocals, dramatic." },
  "Mariah Care-ybear": { real: "Mariah Carey", gender: "FEMALE", style: "Pop-R&B, whistle register, melismatic runs." },
  "Jennifer Lopez-ture": { real: "Jennifer Lopez", gender: "FEMALE", style: "Latin pop, dance-pop, confident diva energy." },
  "Shakira-misu": { real: "Shakira", gender: "FEMALE", style: "Latin pop, unique yodel-like vocal texture, hip shakes." },
  "Enrique Igle-sias": { real: "Enrique Iglesias", gender: "MALE", style: "Latin pop, romantic ballads, smooth vocals." },
  "Pit-bull": { real: "Pitbull", gender: "MALE", style: "Latin-infused pop rap, party anthems, Mr. Worldwide." },
  "Daddy Yan-kee": { real: "Daddy Yankee", gender: "MALE", style: "Reggaeton, fast flow, dembow rhythms, King of Reggaeton." },
  "Bad Bun-ny": { real: "Bad Bunny", gender: "MALE", style: "Latin trap, reggaeton, deep monotone vocals, Puerto Rican." },
  "Karol G-Force": { real: "Karol G", gender: "FEMALE", style: "Reggaeton, Latin pop, empowering female vocals." },
  "Rosalía-mond": { real: "Rosalía", gender: "FEMALE", style: "Flamenco pop, experimental production, unique vocal style." },
  "Malu-ma": { real: "Maluma", gender: "MALE", style: "Reggaeton, Latin pop, smooth romantic vocals." },
  "J Bal-vin": { real: "J Balvin", gender: "MALE", style: "Reggaeton, colorful aesthetic, melodic flow." },
  "Ozuna-mi": { real: "Ozuna", gender: "MALE", style: "Reggaeton, Latin trap, melodic high-pitched vocals." },
  "Anuel AA-battery": { real: "Anuel AA", gender: "MALE", style: "Latin trap, reggaeton, gritty vocals, Real Hasta La Muerte." },
  "Nicky Jam-bon": { real: "Nicky Jam", gender: "MALE", style: "Reggaeton, romantic reggaeton, smooth vocals." },
  "Farru-ko": { real: "Farruko", gender: "MALE", style: "Reggaeton, Latin trap, energetic party anthems." },
  "Luis Fon-si": { real: "Luis Fonsi", gender: "MALE", style: "Latin pop, romantic ballads, smooth tenor." },
  "Ricky Mar-tian": { real: "Ricky Martin", gender: "MALE", style: "Latin pop, energetic, Livin' La Vida Loca vibes." },
  "Marc Anthon-y": { real: "Marc Anthony", gender: "MALE", style: "Salsa, Latin pop, powerful romantic vocals." },
  "Gloria Estefan-t": { real: "Gloria Estefan", gender: "FEMALE", style: "Latin pop, conga rhythms, powerful uplifting vocals." },
  "Gloria Gay-nor": { real: "Gloria Gaynor", gender: "FEMALE", style: "Disco, powerful vocals, I Will Survive anthem energy." },
  "Donna Sum-mer": { real: "Donna Summer", gender: "FEMALE", style: "Disco queen, powerful vocals, dance floor anthems." },
  "Bee Gee-whiz": { real: "Bee Gees", gender: "MALE", style: "Disco falsetto, tight harmonies, Saturday Night Fever." },
  "ABBA-cadabra": { real: "ABBA", gender: "FEMALE", style: "Disco pop, Swedish harmonies, catchy melodies." },
  "Dolly Par-ton": { real: "Dolly Parton", gender: "FEMALE", style: "Country, sweet soprano, storytelling, iconic." },
  "Shania Twain-train": { real: "Shania Twain", gender: "FEMALE", style: "Country pop, confident female vocals, crossover appeal." },
  "Garth Brooks-brothers": { real: "Garth Brooks", gender: "MALE", style: "Country, powerful baritone, arena country energy." },
  "Kenny Ches-ney": { real: "Kenny Chesney", gender: "MALE", style: "Country, beach vibes, laid-back storytelling." },
  "Tim McGraw-l": { real: "Tim McGraw", gender: "MALE", style: "Country, smooth baritone, romantic ballads." },
  "Faith Hill-side": { real: "Faith Hill", gender: "FEMALE", style: "Country pop, powerful vocals, crossover appeal." },
  "Carrie Under-wood": { real: "Carrie Underwood", gender: "FEMALE", style: "Country, powerhouse vocals, American Idol winner." },
  "Keith Ur-ban": { real: "Keith Urban", gender: "MALE", style: "Country rock, guitar virtuoso, Australian twang." },
  "Blake Shel-ton": { real: "Blake Shelton", gender: "MALE", style: "Country, deep baritone, traditional country sound." },
  "Luke Bryan-t": { real: "Luke Bryan", gender: "MALE", style: "Bro-country, party anthems, smooth vocals." },
  "Jason Aldean-mal": { real: "Jason Aldean", gender: "MALE", style: "Country rock, edgy vocals, modern country." },
  "Florida Georgia Line-d": { real: "Florida Georgia Line", gender: "MALE", style: "Bro-country, hip-hop influences, party anthems." },
  "Thomas Rhett-oric": { real: "Thomas Rhett", gender: "MALE", style: "Country pop, smooth vocals, romantic." },
  "Sam Hunt-ing": { real: "Sam Hunt", gender: "MALE", style: "Country, spoken-word style, pop influences." },
  "Kane Brown-ie": { real: "Kane Brown", gender: "MALE", style: "Country R&B, smooth baritone, modern country." },
  "Chris Staple-ton": { real: "Chris Stapleton", gender: "MALE", style: "Southern soul country, gritty bluesy vocals, authentic." },
  "Miranda Lam-bert": { real: "Miranda Lambert", gender: "FEMALE", style: "Country, sassy storytelling, powerful female vocals." },
  "Kacey Mus-graves": { real: "Kacey Musgraves", gender: "FEMALE", style: "Country pop, psychedelic influences, clever lyrics." },
  "Maren Mor-ris": { real: "Maren Morris", gender: "FEMALE", style: "Country pop, powerful vocals, crossover appeal." },
  "Lady A-ntebellum": { real: "Lady A", gender: "FEMALE", style: "Country pop, harmonies, romantic ballads." },
  "Little Big Town-hall": { real: "Little Big Town", gender: "FEMALE", style: "Country harmonies, Kimberly Schlapman sweet vocals." },
  "The Chains-mokers": { real: "The Chainsmokers", gender: "MALE", style: "EDM pop, chilled drops, radio-friendly electronic." },
  "Calvin Har-ris": { real: "Calvin Harris", gender: "MALE", style: "EDM, house, pop crossover, Scottish producer." },
  "David Guet-ta": { real: "David Guetta", gender: "MALE", style: "EDM, big room house, festival anthems, French DJ." },
  "Tiësto-rring": { real: "Tiësto", gender: "MALE", style: "Trance, EDM, progressive house, Dutch DJ legend." },
  "Avicii-ron": { real: "Avicii", gender: "MALE", style: "Melodic house, folk-EDM fusion, uplifting anthems." },
  "Martin Gar-rix": { real: "Martin Garrix", gender: "MALE", style: "Big room house, energetic drops, Dutch DJ prodigy." },
  "Zedd-icine": { real: "Zedd", gender: "MALE", style: "Electro house, pop-EDM, melodic synths, Russian-German." },
  "Diplo-mat": { real: "Diplo", gender: "MALE", style: "Electronic, dancehall, global bass, eclectic producer." },
  "Major Laz-er": { real: "Major Lazer", gender: "MALE", style: "Electronic, dancehall, global party anthems." },
  "Skril-lex": { real: "Skrillex", gender: "MALE", style: "Dubstep, brostep, heavy bass drops, electronic." },
  "Dead-mau5": { real: "deadmau5", gender: "MALE", style: "Progressive house, techno, Canadian electronic producer." },
  "Swedish House Mafia-fia": { real: "Swedish House Mafia", gender: "MALE", style: "Progressive house, anthemic EDM, Swedish supergroup." },
  "Disclo-sure": { real: "Disclosure", gender: "MALE", style: "UK garage, deep house, soulful electronic, brother duo." },
  "Flume-id": { real: "Flume", gender: "MALE", style: "Future bass, experimental electronic, Australian producer." },
  "Ky-go-go": { real: "Kygo", gender: "MALE", style: "Tropical house, piano melodies, relaxed beach vibes." },
  "Alan Walk-er": { real: "Alan Walker", gender: "MALE", style: "Melodic EDM, future bass, Norwegian producer." },
  "Marsh-mello": { real: "Marshmello", gender: "MALE", style: "Future bass, pop-EDM, helmet-wearing DJ, melodic." },
  "Illeni-um": { real: "Illenium", gender: "MALE", style: "Melodic dubstep, future bass, emotional electronic." },
  "Odes-za": { real: "ODESZA", gender: "MALE", style: "Chillwave, future bass, ethereal electronic duo." },
  "Bon I-ver": { real: "Bon Iver", gender: "MALE", style: "Indie folk, auto-tuned falsetto, ethereal, Wisconsin." },
  "Fleet Fox-es": { real: "Fleet Foxes", gender: "MALE", style: "Indie folk, lush harmonies, pastoral, Seattle." },
  "Vampire Week-end": { real: "Vampire Weekend", gender: "MALE", style: "Indie pop, Afro-pop influences, preppy intellectual lyrics." },
  "Arcade Fire-extinguisher": { real: "Arcade Fire", gender: "MALE", style: "Indie rock, orchestral arrangements, anthemic Canadian collective." },
  "The Strokes-brush": { real: "The Strokes", gender: "MALE", style: "Indie rock, Julian Casablancas cool drawl, New York." },
  "Arctic Mon-keys": { real: "Arctic Monkeys", gender: "MALE", style: "Indie rock, Alex Turner witty lyrics, Sheffield swagger." },
  "Kings Of Leon-ardo": { real: "Kings of Leon", gender: "MALE", style: "Southern rock, Caleb Followill raspy vocals, anthemic." },
  "The Black Keys-board": { real: "The Black Keys", gender: "MALE", style: "Blues rock, garage sound, Dan Auerbach gritty vocals." },
  "White Strip-es": { real: "The White Stripes", gender: "MALE", style: "Garage rock, Jack White raw bluesy howl, Detroit duo." },
  "The Ra-conteurs": { real: "The Raconteurs", gender: "MALE", style: "Rock, Jack White, Brendan Benson, power pop." },
  "Jack White-out": { real: "Jack White", gender: "MALE", style: "Garage rock, blues, raw vocals, guitar virtuoso." },
  "Queens Of The Stone Age-nt": { real: "Queens of the Stone Age", gender: "MALE", style: "Stoner rock, Josh Homme desert groove, heavy riffs." },
  "Muse-um": { real: "Muse", gender: "MALE", style: "Alternative rock, Matt Bellamy falsetto, operatic grandeur." },
  "Thirty Seconds To Mars-h": { real: "Thirty Seconds to Mars", gender: "MALE", style: "Alternative rock, Jared Leto dramatic vocals, space themes." },
  "A Day To Remem-ber": { real: "A Day to Remember", gender: "MALE", style: "Pop punk metalcore, Jeremy McKinnon aggressive melodic." },
  "Bring Me The Hori-zon": { real: "Bring Me the Horizon", gender: "MALE", style: "Metalcore to pop rock, Oli Sykes scream-sing, Sheffield." },
  "Avenged Seven-fold": { real: "Avenged Sevenfold", gender: "MALE", style: "Heavy metal, M. Shadows gritty vocals, dual guitars." },
  "Disturbed-sleep": { real: "Disturbed", gender: "MALE", style: "Nu metal, David Draiman staccato bark, Down With The Sickness." },
  "Korn-flakes": { real: "Korn", gender: "MALE", style: "Nu metal, Jonathan Davis scatting emotional vocals, bagpipes." },
  "Limp Biz-kit": { real: "Limp Bizkit", gender: "MALE", style: "Nu metal, Fred Durst rap-rock, DJ Lethal scratches." },
  "Rage Against The Machine-gun": { real: "Rage Against the Machine", gender: "MALE", style: "Rap metal, Zack de la Rocha political fury, Tom Morello." },
  "Audioslave-ment": { real: "Audioslave", gender: "MALE", style: "Hard rock, Chris Cornell soaring vocals, RATM rhythm section." },
  "Soundgarden-hoe": { real: "Soundgarden", gender: "MALE", style: "Grunge, Chris Cornell four-octave range, heavy riffs." },
  "Alice In Chains-aw": { real: "Alice in Chains", gender: "MALE", style: "Grunge, Layne Staley haunting harmonies, dark sludge." },
  "Stone Temple Pil-ots": { real: "Stone Temple Pilots", gender: "MALE", style: "Grunge, Scott Weiland dynamic vocals, 90s alternative." },
  "Bush-wood": { real: "Bush", gender: "MALE", style: "Grunge, Gavin Rossdale raspy vocals, British alternative." },
  "Creed-ible": { real: "Creed", gender: "MALE", style: "Post-grunge, Scott Stapp baritone rumble, Christian themes." },
  "Nickel-back-pain": { real: "Nickelback", gender: "MALE", style: "Post-grunge, Chad Kroeger raspy rock vocals, radio rock." },
  "Three Doors Down-town": { real: "3 Doors Down", gender: "MALE", style: "Post-grunge, Brad Arnold earnest vocals, emotional rock." },
  "Matchbox Twenty-One": { real: "Matchbox Twenty", gender: "MALE", style: "Alternative rock, Rob Thomas soulful pop vocals, Florida." },
  "Goo Goo Doll-ars": { real: "Goo Goo Dolls", gender: "MALE", style: "Alternative rock, John Rzeznik raspy vocals, power ballads." },
  "The Cran-berries": { real: "The Cranberries", gender: "FEMALE", style: "Alternative rock, Dolores O'Riordan yodel-like vocals, Irish." },
  "No Doubt-ful": { real: "No Doubt", gender: "FEMALE", style: "Ska punk, Gwen Stefani powerful vocals, Anaheim." },
  "Sublime-ime": { real: "Sublime", gender: "MALE", style: "Ska punk reggae, Bradley Nowell smooth vocals, Long Beach." },
  "Reel Big Fish-bone": { real: "Reel Big Fish", gender: "MALE", style: "Ska punk, horns, energetic, Orange County." },
  "Less Than Jake-gyllenhaal": { real: "Less Than Jake", gender: "MALE", style: "Ska punk, horns, fast energetic, Florida." },
  "Gold-fin-ger": { real: "Goldfinger", gender: "MALE", style: "Ska punk, pop punk, energetic horns, Los Angeles." },
  "The Off-spring": { real: "The Offspring", gender: "MALE", style: "Punk rock, Dexter Holland high vocals, Orange County." },
  "Bad Reli-gion": { real: "Bad Religion", gender: "MALE", style: "Punk rock, Greg Graffin intellectual lyrics, harmonies." },
  "Social Distor-tion": { real: "Social Distortion", gender: "MALE", style: "Punk rock, Mike Ness rockabilly influence, Orange County." },
  "Rancid-cid": { real: "Rancid", gender: "MALE", style: "Punk rock, Tim Armstrong gravelly vocals, Operation Ivy." },
  "Penny-wise": { real: "Pennywise", gender: "MALE", style: "Punk rock, fast melodic, Fletcher Dragge guitars." },
  "Sum 41-teen": { real: "Sum 41", gender: "MALE", style: "Pop punk, Deryck Whibley nasally vocals, Canadian." },
  "Simple Plan-et": { real: "Simple Plan", gender: "MALE", style: "Pop punk, Pierre Bouvier emotional vocals, Canadian." },
  "New Found Glory-ous": { real: "New Found Glory", gender: "MALE", style: "Pop punk, Jordan Pundik pop vocals, Florida." },
  "Yellow-card": { real: "Yellowcard", gender: "MALE", style: "Pop punk, violin-driven, Ryan Key vocals, Florida." },
  "Taking Back Sun-day": { real: "Taking Back Sunday", gender: "MALE", style: "Emo, Adam Lazzara call-and-response vocals, Long Island." },
  "Brand New-ton": { real: "Brand New", gender: "MALE", style: "Emo, Jesse Lacey introspective lyrics, Long Island." },
  "Jimmy Eat World-wide": { real: "Jimmy Eat World", gender: "MALE", style: "Emo pop rock, Jim Adkins earnest vocals, Arizona." },
  "Death Cab For Cutie-pie": { real: "Death Cab for Cutie", gender: "MALE", style: "Indie rock, Ben Gibbard soft vocals, melancholic." },
  "The Postal Serv-ice": { real: "The Postal Service", gender: "MALE", style: "Indie electronic, Ben Gibbard soft vocals, twee." },
  "Modest Mouse-trap": { real: "Modest Mouse", gender: "MALE", style: "Indie rock, Isaac Brock twitchy vocals, Pacific Northwest." },
  "The Shins-plints": { real: "The Shins", gender: "MALE", style: "Indie pop, James Mercer high nasal vocals, Albuquerque." },
  "Death From Above 1979-er": { real: "Death from Above 1979", gender: "MALE", style: "Dance-punk, bass and drums duo, Toronto." },
  "LCD Soundsys-tem": { real: "LCD Soundsystem", gender: "MALE", style: "Dance-punk, James Murphy talk-sing, Brooklyn." },
  "Hot Chip-munk": { real: "Hot Chip", gender: "MALE", style: "Electropop, quirky, British synth-pop." },
  "MGMT-ment": { real: "MGMT", gender: "MALE", style: "Psychedelic pop, Andrew VanWyngarden falsetto, Connecticut." },
  "Tame Impala-la": { real: "Tame Impala", gender: "MALE", style: "Psychedelic pop, Kevin Parker dreamy production, Australian." },
  "Portugal. The Man-nequin": { real: "Portugal. The Man", gender: "MALE", style: "Indie rock, John Gourley high falsetto, Alaska." },
  "Foster The Peo-ple": { real: "Foster the People", gender: "MALE", style: "Indie pop, Mark Foster falsetto, Pumped Up Kicks." },
  "Young The Gi-ant": { real: "Young the Giant", gender: "MALE", style: "Indie rock, Sameer Gadhia soaring vocals, California." },
  "Walk The Moon-landing": { real: "Walk the Moon", gender: "MALE", style: "Indie pop, Nicholas Petricca energetic vocals, Shut Up And Dance." },
  "Two Door Cinema Club-sandwich": { real: "Two Door Cinema Club", gender: "MALE", style: "Indie pop, Alex Trimble Irish vocals, danceable guitars." },
  "Passion Pit-bull": { real: "Passion Pit", gender: "MALE", style: "Electropop, Michael Angelakos high falsetto, Massachusetts." },
  "Phoenix-rising": { real: "Phoenix", gender: "MALE", style: "Indie pop, Thomas Mars smooth French vocals, Paris." },
  "French Kicks-ball": { real: "French Kicks", gender: "MALE", style: "Indie rock, jangly guitars, New York." },
  "The Rapture-ture": { real: "The Rapture", gender: "MALE", style: "Dance-punk, cowbell, New York." },
  "Bloc Par-ty": { real: "Bloc Party", gender: "MALE", style: "Indie rock, Kele Okereke British vocals, danceable." },
  "Inter-poll": { real: "Interpol", gender: "MALE", style: "Post-punk revival, Paul Banks baritone, New York." },
  "Joy Divi-sion": { real: "Joy Division", gender: "MALE", style: "Post-punk, Ian Curtis dramatic baritone, Manchester." },
  "New Or-der": { real: "New Order", gender: "MALE", style: "New wave, electronic, Bernard Sumner flat vocals, Manchester." },
  "The Cure-ious": { real: "The Cure", gender: "MALE", style: "Gothic rock, Robert Smith mopey vocals, post-punk." },
  "Depeche Mode-l": { real: "Depeche Mode", gender: "MALE", style: "Synth-pop, dark wave, Dave Gahan deep baritone." },
  "Pet Shop Boys-will-be-boys": { real: "Pet Shop Boys", gender: "MALE", style: "Synth-pop, Neil Tennant deadpan vocals, British duo." },
  "New Kids On The Block-chain": { real: "New Kids on the Block", gender: "MALE", style: "Boy band, New Jack Swing, Boston." },
  "Backstreet Boys-will-be-boys": { real: "Backstreet Boys", gender: "MALE", style: "Boy band, harmonies, Orlando pop." },
  "NSYNC-hronized": { real: "NSYNC", gender: "MALE", style: "Boy band, Justin Timberlake lead, Orlando pop." },
  "98 De-grees": { real: "98 Degrees", gender: "MALE", style: "Boy band, harmonies, adult contemporary." },
  "Boyz II Men-tal": { real: "Boyz II Men", gender: "MALE", style: "R&B harmonies, Philadelphia soul, ballads." },
  "Jode-ci": { real: "Jodeci", gender: "MALE", style: "R&B, new jack swing, gospel-influenced harmonies." },
  "Bell Biv DeVoe-lution": { real: "Bell Biv DeVoe", gender: "MALE", style: "New jack swing, hip-hop soul, Boston." },
  "Color Me Badd-ly": { real: "Color Me Badd", gender: "MALE", style: "R&B harmonies, new jack swing, Oklahoma." },
  "All-4-One": { real: "All-4-One", gender: "MALE", style: "R&B vocal group, harmonies, California." },
  "Soul For Real-ly": { real: "Soul For Real", gender: "MALE", style: "R&B harmonies, new jack swing, 90s." },
  "Dru Hill-side": { real: "Dru Hill", gender: "MALE", style: "R&B, Sisqó lead vocals, Baltimore." },
  "Silk-y": { real: "Silk", gender: "MALE", style: "R&B, smooth harmonies, Atlanta." },
  "SWV-ery": { real: "SWV", gender: "FEMALE", style: "R&B, Coko powerful lead, harmonies, New York." },
  "Total-ly": { real: "Total", gender: "FEMALE", style: "R&B, Bad Boy Records, hip-hop soul." },
  "702-nd": { real: "702", gender: "FEMALE", style: "R&B, Las Vegas trio, Missy Elliott proteges." },
  "Blaque-ey": { real: "Blaque", gender: "FEMALE", style: "R&B, Left Eye proteges, 90s girl group." },
  "3LW-olves": { real: "3LW", gender: "FEMALE", style: "R&B pop, teenage girl group, early 2000s." },
  "Danity Kane-ine": { real: "Danity Kane", gender: "FEMALE", style: "R&B pop, Making the Band, harmonies." },
  "Pussycat Doll-ars": { real: "Pussycat Dolls", gender: "FEMALE", style: "Pop, burlesque, Nicole Scherzinger lead vocals." },
  "Fifth Har-mony": { real: "Fifth Harmony", gender: "FEMALE", style: "Pop girl group, X Factor, Camila Cabello alumnae." },
  "Little Mix-tape": { real: "Little Mix", gender: "FEMALE", style: "Pop girl group, X Factor winners, harmonies." },
  "Spice Girls-night-out": { real: "Spice Girls", gender: "FEMALE", style: "Pop girl group, British, Girl Power anthems." },
  "Destiny's Child-ish": { real: "Destiny's Child", gender: "FEMALE", style: "R&B girl group, Beyoncé lead, Houston." },
  "TLC-care": { real: "TLC", gender: "FEMALE", style: "R&B hip-hop, Atlanta, T-Boz Left Eye Chili." },
  "En Vouge": { real: "En Vogue", gender: "FEMALE", style: "R&B harmonies, Oakland, Funky Divas." },
  "Salt-N-Pepa-rmint": { real: "Salt-N-Pepa", gender: "FEMALE", style: "Hip-hop duo, Queens, Push It." },
  "Eve-ryday": { real: "Eve", gender: "FEMALE", style: "Hip-hop, Ruff Ryders, Philadelphia." },
  "Missy Elli-ott": { real: "Missy Elliott", gender: "FEMALE", style: "Hip-hop, innovative production, Virginia." },
  "Lil' Kim-chi": { real: "Lil' Kim", gender: "FEMALE", style: "Hip-hop, raunchy lyrics, Brooklyn." },
  "Foxy Brow-ny": { real: "Foxy Brown", gender: "FEMALE", style: "Hip-hop, Brooklyn, Ill Na Na." },
  "Trina-misu": { real: "Trina", gender: "FEMALE", style: "Hip-hop, Miami, raunchy confident flow." },
  "Remy Ma-ple": { real: "Remy Ma", gender: "FEMALE", style: "Hip-hop, Bronx, Terror Squad." },
  "Da Brat-wurst": { real: "Da Brat", gender: "FEMALE", style: "Hip-hop, Chicago, So So Def, tomboy style." },
  "Left Eye-blind": { real: "Lisa Left Eye Lopes", gender: "FEMALE", style: "Hip-hop, TLC, rapping and singing, Atlanta." },
  "Queen Lati-fah": { real: "Queen Latifah", gender: "FEMALE", style: "Hip-hop, Newark, U.N.I.T.Y., jazz influences." },
  "MC Lyte-ning": { real: "MC Lyte", gender: "FEMALE", style: "Hip-hop, Brooklyn, pioneering female MC." },
  "Rox-anne Shanté": { real: "Roxanne Shanté", gender: "FEMALE", style: "Hip-hop, Queensbridge, Roxanne's Revenge." },
  "Monie Love-ly": { real: "Monie Love", gender: "FEMALE", style: "Hip-hop, British-American, Ladies First." },
  "Yo-Yo-yo": { real: "Yo-Yo", gender: "FEMALE", style: "Hip-hop, Compton, West Coast female MC." },
  "Bahamadia-mond": { real: "Bahamadia", gender: "FEMALE", style: "Hip-hop, Philadelphia, jazz-influenced lyricism." },
  "Jean Grae-y": { real: "Jean Grae", gender: "FEMALE", style: "Hip-hop, South Africa-born, NYC, complex lyricism." },
  "Raps-ody": { real: "Rapsody", gender: "FEMALE", style: "Hip-hop, North Carolina, conscious lyricism." },
  "Nona-me": { real: "Noname", gender: "FEMALE", style: "Hip-hop, Chicago, poetic jazz-influenced rap." },
  "Little Simz-ter": { real: "Little Simz", gender: "FEMALE", style: "Hip-hop, London, introspective, Mercury Prize winner." },
  "Stefflon Don-ut": { real: "Stefflon Don", gender: "FEMALE", style: "Hip-hop, dancehall, British-Jamaican." },
  "Ms. Dy-namite": { real: "Ms. Dynamite", gender: "FEMALE", style: "Hip-hop, UK garage, British." },
  "Shystie-boots": { real: "Shystie", gender: "FEMALE", style: "Hip-hop, grime, British." },
  "Lady Les-hur": { real: "Lady Leshurr", gender: "FEMALE", style: "Hip-hop, grime, Birmingham, Queen's Speech." },
  "Ms. Banks-y": { real: "Ms. Banks", gender: "FEMALE", style: "Hip-hop, British-Nigerian, confident flow." },
  "Iggy Azalea-nt": { real: "Iggy Azalea", gender: "FEMALE", style: "Hip-hop, Australian, Southern rap influence." },
  "Cup-cakKe": { real: "CupcakKe", gender: "FEMALE", style: "Hip-hop, Chicago, explicit comedy rap." },
  "Saweetie-pie": { real: "Saweetie", gender: "FEMALE", style: "Hip-hop, Bay Area, Icy Girl." },
  "Coi Ler-ay": { real: "Coi Leray", gender: "FEMALE", style: "Hip-hop, New Jersey, melodic rap." },
  "Flo Milli-on": { real: "Flo Milli", gender: "FEMALE", style: "Hip-hop, Alabama, confident, viral." },
  "Latto-tto": { real: "Latto", gender: "FEMALE", style: "Hip-hop, Atlanta, confident female rapper." },
  "GloRilla-gorilla": { real: "GloRilla", gender: "FEMALE", style: "Hip-hop, Memphis, aggressive flow." },
  "Sexyy Red-velvet": { real: "Sexyy Red", gender: "FEMALE", style: "Hip-hop, St. Louis, raunchy confident." },
  "Ice Spice-rack": { real: "Ice Spice", gender: "FEMALE", style: "Hip-hop, Bronx, drill influence, Munch." },
  "Doechii-tee": { real: "Doechii", gender: "FEMALE", style: "Hip-hop, Tampa, versatile flow." },
  "Baby Tate-r-tot": { real: "Baby Tate", gender: "FEMALE", style: "Hip-hop, Atlanta, playful confident." },
  "Rubi Rose-bud": { real: "Rubi Rose", gender: "FEMALE", style: "Hip-hop, Kentucky, model rapper." },
  "Asian Doll-ar": { real: "Asian Doll", gender: "FEMALE", style: "Hip-hop, Dallas, aggressive drill." },
  "Rocky Badd-ie": { real: "Rocky Badd", gender: "FEMALE", style: "Hip-hop, Detroit, battle rap." },
  "Kash Doll-ar": { real: "Kash Doll", gender: "FEMALE", style: "Hip-hop, Detroit, confident female rapper." },
  "DeJ Loaf-er": { real: "DeJ Loaf", gender: "FEMALE", style: "Hip-hop, Detroit, melodic rap." },
  "Tierra Whack-amole": { real: "Tierra Whack", gender: "FEMALE", style: "Hip-hop, Philadelphia, experimental, Whack World." },
  "Rico Nas-ty": { real: "Rico Nasty", gender: "FEMALE", style: "Hip-hop, Maryland, punk rap, aggressive." },
  "Tokis-cha": { real: "Tokischa", gender: "FEMALE", style: "Dembow, Dominican, provocative reggaeton." },
  "Young M.A.-n": { real: "Young M.A", gender: "FEMALE", style: "Hip-hop, Brooklyn, masculine-presenting female rapper." },
  "Leikeli47-eleven": { real: "Leikeli47", gender: "FEMALE", style: "Hip-hop, Brooklyn, masked rapper, versatile." },
  "Chika-chu": { real: "CHIKA", gender: "FEMALE", style: "Hip-hop, Alabama, socially conscious, Warner Bros." },
  "Sa-Roc-ket": { real: "Sa-Roc", gender: "FEMALE", style: "Hip-hop, Atlanta, conscious lyricism, Rhymesayers." },
  "NoName-call-ing": { real: "Noname", gender: "FEMALE", style: "Hip-hop, Chicago, poetic jazz-influenced rap." },
};

const GENERATION_MODES: Record<string, { promptAdd: string; lyricStructure: string }> = {
  normal: { 
    promptAdd: 'Professional studio production, polished mix, clear vocals, balanced instrumentation',
    lyricStructure: 'Standard verse-chorus-verse-chorus-bridge-chorus structure'
  },
  funky: { 
    promptAdd: 'Funky groove with slap bass, wah-wah guitars, tight drums, soulful Rhodes, clavinet, horn stabs, 70s/80s funk influence, syncopated rhythms',
    lyricStructure: 'Call-and-response patterns, groovy sections, danceable chorus'
  },
  unhinged: { 
    promptAdd: 'ABSOLUTELY CHAOTIC genre-fusion, unexpected tempo changes, wild experimental production, bizarre instrumentation, glitches, genre switches mid-song, maximalist chaos',
    lyricStructure: 'Nonlinear, stream-of-consciousness, surreal sections, unpredictable structure'
  },
  cinematic: { 
    promptAdd: 'Epic cinematic production, orchestral elements, dramatic dynamics, movie soundtrack quality, sweeping strings, powerful brass, massive percussion',
    lyricStructure: 'Epic intro, building verses, explosive chorus, dramatic bridge, grand finale'
  },
  lofi_chill: { 
    promptAdd: 'Lo-fi hip hop with vinyl crackle, dusty samples, warm Rhodes piano, muted bass, relaxed boom-bap drums, tape hiss, cozy atmosphere',
    lyricStructure: 'Mellow verses, relaxed chorus, introspective feel'
  },
  industrial_metal: { 
    promptAdd: 'Industrial metal with mechanical percussion, distorted guitars, factory machine samples, harsh noise, dystopian atmosphere, crushing compression',
    lyricStructure: 'Aggressive verses, heavy chorus, mechanical bridge'
  },
  dream_pop: { 
    promptAdd: 'Dream pop with washed out guitars, heavy reverb, ethereal vocals, hazy atmosphere, warm tape saturation, swirling textures, shoegaze influence',
    lyricStructure: 'Floating verses, dreamy chorus, hazy bridge, ethereal outro'
  },
  punk_raw: { 
    promptAdd: 'Raw punk rock with lo-fi recording, fast tempos, distorted guitars, aggressive drums, shouted vocals, DIY ethos, rebellious energy',
    lyricStructure: 'Short intense verses, punchy chorus, minimal bridge, fast and direct'
  },
  trap_dark: { 
    promptAdd: 'Dark trap with booming 808s, rapid hi-hats, ominous synth pads, dark atmosphere, street aesthetic, minimal melodic elements, hard-hitting drums',
    lyricStructure: 'Dark verses, hard-hitting chorus, trap-style flow patterns'
  },
  hyperpop_maximalist: { 
    promptAdd: 'Hyperpop with extreme pitch-shifted vocals, glitchy production, maximalist sound design, bubblegum bass, sugary synths, chaotic energy',
    lyricStructure: 'High-energy sections, dramatic shifts, maximalist chorus'
  },
  acoustic_folk: { 
    promptAdd: 'Acoustic folk with organic instrumentation, fingerpicked guitar, raw vocals, storytelling focus, warm natural reverb, unplugged aesthetic',
    lyricStructure: 'Storytelling verses, melodic chorus, intimate bridge, acoustic outro'
  },
  phonk_memphis: { 
    promptAdd: 'Phonk with cowbell percussion, chopped Memphis rap samples, heavy distorted 808s, reverb-drenched atmosphere, drifting car culture',
    lyricStructure: 'Hypnotic verses, bass-heavy chorus, trance-inducing patterns'
  }
};

const VOCAL_TAGS: Record<string, string[]> = {
  "male vocalist": ["male vocalist"],
  "female vocalist": ["female vocalist"],
  "male rapper": ["male vocalist"],
  "female rapper": ["female vocalist"],
  "choir": ["choir"],
  "robotic voice": ["robotic voice"],
  "screaming vocal": ["screaming vocal"],
  "any voice": [],
  "duet": ["male vocalist", "female vocalist"],
  "vocal group": ["vocal group"],
  "screamo": ["screaming vocal"],
  "androgynous vocals": ["androgynous vocals"],
  "a cappella": ["a cappella"],
};

export async function POST(req: Request) {
  try {
    if (!SONAUTO_API_KEY) {
      return NextResponse.json({ error: 'SONAUTO_API_KEY not configured' }, { status: 500 });
    }

    const { prompt, artist, artists, genre, customLyrics, mood, tempo, persona, chaos, arc, generationMode, vocalStyle, vocalistAssignments } = await req.json();

    // Handle multi-artist mode
    const artistList = artists && artists.length > 0
      ? artists.map((a: string) => ({
          key: a,
          ...(ARTIST_MAP[a] || { real: a, gender: "MALE", style: "authentic vocal style" })
        }))
      : [{ key: artist, ...(ARTIST_MAP[artist] || { real: artist, gender: "MALE", style: "authentic vocal style" }) }];

    const primaryArtist = artistList[0];
    const realArtist = primaryArtist.real;
    const genderTag = primaryArtist.gender === 'FEMALE' ? 'female vocalist' : 'male vocalist';

    const promptStrength = 1.0;
    const modeMod = GENERATION_MODES[generationMode] || GENERATION_MODES.normal;

    // Build multi-voice prompt if multiple artists
    let enhancedPrompt = '';
    if (artistList.length > 1) {
      // Multi-voice mode: MATCHED TO WORKING FORMAT (like the Llama battles)
      enhancedPrompt = `VOCAL BATTLE SONG:\n`;
      artistList.forEach((a: { real: string; style: string; gender: string }, i: number) => {
        const vocalDelivery = a.style.includes('RHYTHMIC') || a.style.includes('RAP') ? 'Rhythmic & Sharp delivery' : 'Emotional & Raw delivery';
        const vocalistLabel = a.gender === 'FEMALE' ? 'female vocalist vocalist' : 'male vocalist vocalist';
        enhancedPrompt += `VOCALIST ${i + 1}: ${a.real}. ROLE: ${i === 0 ? 'LEAD' : 'PARTNER'}. SINGER: ${a.real}. VOCAL STYLE: ${a.style.replace(/\.+$/, '')}. ${vocalistLabel} with ${vocalDelivery}.\n`;
      });
    } else {
      // Single voice mode - MATCHED TO WORKING MARCH FORMAT
      // Uses LEAD VOICE format like the working Coldplay/Dave/Post Malone generations
      const vocalType = primaryArtist.gender === 'FEMALE' ? 'female vocalist' : 'male vocalist';
      const vocalDelivery = primaryArtist.style.includes('RHYTHMIC') || primaryArtist.style.includes('RAP') ? 'Rhythmic & Sharp delivery' : 'Emotional & Raw delivery';
      enhancedPrompt = `LEAD VOICE: ${realArtist}. GENDER: ${primaryArtist.gender}. STYLE: ${primaryArtist.style.replace(/\.+$/, '')}. ${vocalType}. `;
      // Add specific singing style hints based on genre
      if (genre && (genre.toLowerCase().includes('rap') || genre.toLowerCase().includes('drill') || genre.toLowerCase().includes('grime'))) {
        enhancedPrompt += `RAP CADENCE ONLY. `;
      } else if (genre && (genre.toLowerCase().includes('metal') || genre.toLowerCase().includes('rock'))) {
        enhancedPrompt += `POWER VOCALS. `;
      } else {
        enhancedPrompt += `MELODIC SINGING. `;
      }
    }
    if (persona && persona !== 'The Rebel') {
      enhancedPrompt += `Sung from the perspective of: ${persona}. `;
    }
    if (arc && arc !== 'Static (Consistent Vibe)') {
      enhancedPrompt += `Emotional arc: ${arc}. `;
    }
    enhancedPrompt += `Production: ${modeMod.promptAdd}. `;
    enhancedPrompt += `Song Structure: ${modeMod.lyricStructure}.`;

    let finalLyrics = customLyrics;

    if (!finalLyrics || finalLyrics.trim() === '') {
      try {
        if (MINIMAX_API_KEY) {
          const lyricPrompt = `Write a FULL 3-minute song lyric with proper song structure in this format:

[Intro]
(Instrumental or atmospheric intro)

[Verse 1]
(First verse lyrics)

[Chorus]
(First chorus with catchy hook)

[Verse 2]
(Second verse with new lyrical content)

[Chorus]
(Repeat chorus with hook)

[Bridge]
(Climactic bridge section - different from verses)

[Chorus]
(Final chorus - most intense/energetic)

[Outro]
(Closing section or fade)

---

Style influence: ${realArtist} (${primaryArtist.style})
Production: ${modeMod.promptAdd}

Topic: "${prompt}"
Genre: ${genre || 'pop'}
Mood: ${mood || 'energetic'}
Tempo: ${tempo || 'Mid-tempo'}
Persona: ${persona || 'The Rebel'}
Emotional Arc: ${arc || 'Static'}

Structure Guidance: ${modeMod.lyricStructure}

Ensure the lyrics are long enough for a complete 2-3 minute track. Start directly with [Intro] or [Verse 1]. ONLY return raw lyrics for ONE single song. No titles, no markdown formatting, no explanations.`;

          const lyricRes = await fetch('https://api.minimax.chat/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${MINIMAX_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'MiniMax-M2.7',
              messages: [
                { role: 'system', content: 'You are a professional songwriter.' },
                { role: 'user', content: lyricPrompt }
              ],
              temperature: 0.8,
              max_tokens: 4000
            })
          });

          if (lyricRes.ok) {
            const lyricData = await lyricRes.json();
            const lyricText = lyricData.choices?.[0]?.message?.content;
            if (lyricText) finalLyrics = lyricText.trim();
          }
        }
      } catch (e) {
        console.error('MiniMax lyric generation failed', e);
      }
    }

    if (!finalLyrics || finalLyrics.trim() === '') {
      finalLyrics = `[Verse 1]\nIn the style of ${realArtist}, let me tell you about ${prompt}\nIt's ${genre || 'a song'}, feeling ${mood || 'good'}\nWith ${primaryArtist.style} leading the way\n\n[Chorus]\nOh yeah, ${prompt}!\nSinging it proud, singing it loud!`;
    }

    if (finalLyrics && !finalLyrics.toLowerCase().includes('[intro]')) {
       finalLyrics = `[Intro]\n` + finalLyrics;
    }

    // Build SonAuto API tags array from genre, mood, and artist vocal type
    const tags: string[] = [];

    // Extract genre tags from the creative genre string
    if (genre) {
      const genreLower = genre.toLowerCase();
      // Map common genre terms to SonAuto tags
      const genreMappings: [string, string][] = [
        ['metal', 'metal'], ['rock', 'rock'], ['pop', 'pop'], ['jazz', 'jazz'],
        ['hip hop', 'hip-hop'], ['rap', 'rap'], ['trap', 'trap'], ['drill', 'drill'],
        ['country', 'country'], ['folk', 'folk'], ['blues', 'blues'], ['soul', 'soul'],
        ['r&b', 'r&b'], ['funk', 'funk'], ['reggae', 'regae'], ['classical', 'classical'],
        ['electronic', 'electronic'], ['edm', 'electronic'], ['techno', 'techno'],
        ['house', 'house'], ['synthwave', 'synthwave'], ['disco', 'disco'],
        ['punk', 'punk'], ['grunge', 'grunge'], ['emo', 'emo'], ['hardcore', 'hardcore'],
        ['industrial', 'industrial'], ['ambient', 'ambient'], ['lo-fi', 'lo-fi'],
        ['lofi', 'lo-fi'], ['shoegaze', 'shoegaze'], ['psychedelic', 'psychedelic'],
        ['dubstep', 'dubstep'], ['drum', 'drum'], ['bass', 'bass'], ['phonk', 'phonk'],
        ['grindcore', 'metal'], ['death metal', 'metal'], ['doom', 'doom'],
        ['classical', 'classical'], ['opera', 'opera'], ['baroque', 'baroque'],
        ['orchestral', 'orchestral'], ['symphonic', 'symphonic'], ['cinematic', 'cinematic'],
        ['soundtrack', 'soundtrack'], ['score', 'score'],
      ];
      for (const [term, tag] of genreMappings) {
        if (genreLower.includes(term)) {
          tags.push(tag);
        }
      }
      // If no specific tags found, add the genre as-is if it's short enough
      if (tags.length === 0 && genre.length < 30) {
        tags.push(genreLower);
      }
    }

    // Add mood as a tag
    if (mood) {
      tags.push(mood.toLowerCase());
    }

    // Add era tag (default to 2020s for modern sound)
    tags.push('2020s');

    // Add vocal type based on artist gender AND selected vocal style
    tags.push(genderTag);

    // Add vocal style tags if specified and not 'mixed' (which means let API decide)
    if (vocalStyle && vocalStyle !== 'mixed' && VOCAL_TAGS[vocalStyle]) {
      const vocalTags = VOCAL_TAGS[vocalStyle];
      vocalTags.forEach(tag => {
        if (!tags.includes(tag)) {
          tags.push(tag);
        }
      });
    }

    // Add PARODY STYLE and RAW STUDIO VOCALS like working generations
    tags.push('PARODY STYLE');
    tags.push('RAW STUDIO VOCALS');

    let requestBody: any = {};

    if (finalLyrics && finalLyrics.trim() !== '') {
      // When lyrics are provided, use only lyrics + prompt (NOT tags per SonAuto rules)
      requestBody = {
        instrumental: false,
        prompt_strength: promptStrength,
        output_format: "mp3",
        enable_streaming: false,
        lyrics: finalLyrics,
        prompt: enhancedPrompt,  // Required when lyrics provided
      };
    } else {
      // When no lyrics, use tags and prompt
      requestBody = {
        instrumental: false,
        prompt_strength: promptStrength,
        output_format: "mp3",
        enable_streaming: false,
        tags: tags,
        prompt: enhancedPrompt,
      };
    }

    let response;
    let data;
    let retries = 3;
    let lastError = null;

    for (let i = 0; i < retries; i++) {
      try {
        response = await fetch('https://api.sonauto.ai/v1/generations/v3', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SONAUTO_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });
        
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          const responseText = await response.text();
          
          if (contentType && contentType.includes('application/json')) {
            data = JSON.parse(responseText);
          } else {
            data = { task_id: responseText.trim() };
          }
          break;
        }
        
        lastError = await response.text();
        console.error(`Sonauto API Error (Attempt ${i+1}):`, lastError);
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        console.error(`Sonauto Fetch Error (Attempt ${i+1}):`, e);
      }
      await new Promise(res => setTimeout(res, 2000));
    }

    if (!response?.ok) {
      return NextResponse.json({ error: 'Failed to start generation', details: lastError }, { status: response?.status || 500 });
    }

    const taskId = data?.task_id || data?.id || data?.generation_id;
    if (!taskId) {
      return NextResponse.json({ error: 'No task_id in response', details: JSON.stringify(data) }, { status: 500 });
    }

    return NextResponse.json({ success: true, task_id: taskId, lyrics: finalLyrics });
  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
