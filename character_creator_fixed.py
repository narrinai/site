#!/usr/bin/env python3

import os
import requests
import time
import random
import itertools
from dotenv import load_dotenv

# Laad environment variabelen
load_dotenv()

# Configuratie vanuit .env bestand
AIRTABLE_TOKEN = os.getenv('AIRTABLE_TOKEN')
AIRTABLE_BASE = os.getenv('AIRTABLE_BASE')

# ANSI kleuren voor terminal output
class Colors:
    RED = '\033[31m'
    GREEN = '\033[32m'
    YELLOW = '\033[33m'
    BLUE = '\033[34m'
    MAGENTA = '\033[35m'
    CYAN = '\033[36m'
    WHITE = '\033[37m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def log(color, message):
    """Print gekleurde berichten naar console"""
    print(f"{color}{message}{Colors.RESET}")

# Categorieën en tags definitie (database waarden)
CATEGORIES = [
    'historical', 'fantasy', 'anime-manga', 'celebrity', 'gaming', 
    'movies-tv', 'mythology', 'original', 'ai-assistant', 'educational',
    'fitness-coach', 'business-coach', 'language-coach', 'accounting-coach', 'career-coach',
    'negotiation-coach', 'creativity-coach', 'study-coach', 'relationship-coach', 
    'mindfulness-coach', 'cooking-coach', 'writing-coach', 'parody', 'rpg', 'romance',
    'middle-aged', 'gen-z', 'older', 'humor', 'other', 'fictional'
]

TAGS = [
    'academic', 'action', 'actor', 'advancement', 'adventure', 'ancient', 'arcade', 'artist',
    'artistic', 'artistic-block', 'athletic', 'awareness', 'baking', 'balance', 'brainstorming',
    'calm', 'cardio', 'chef', 'comedy', 'communication', 'concept', 'connection', 'conversation',
    'cooking', 'corporate', 'creative', 'cuisine', 'culinary', 'culture', 'custom', 'dating',
    'design', 'detective', 'development', 'digital', 'divine', 'documentary', 'drama', 'efficient',
    'empathy', 'emperor', 'entertainment', 'entrepreneur', 'epic', 'exam-prep', 'exercise',
    'experimental', 'expression', 'famous', 'fantasy', 'fluency', 'focus', 'folklore', 'food',
    'fps', 'friendly', 'friendship', 'gen-z', 'goals', 'god', 'goddess', 'grammar', 'growth', 'guidance',
    'health', 'helpful', 'hero', 'hollywood', 'horror', 'humor', 'imagination', 'imaginative', 'indie',
    'influencer', 'ingredients', 'inner-peace', 'innovation', 'innovative', 'inspiration',
    'interview', 'job-search', 'josei', 'king', 'kitchen', 'knowledge', 'knowledgeable', 'leader',
    'leadership', 'learning', 'legend', 'love', 'magic', 'management', 'marriage', 'mecha',
    'medieval', 'meditation', 'mentor', 'middle-aged', 'military', 'mindset', 'mmorpg', 'modern', 'motivation',
    'multilingual', 'musician', 'mystery', 'mystical', 'myth', 'networking', 'ninja', 'note-taking',
    'nutrition', 'older', 'organization', 'parody', 'peaceful', 'personal', 'personal-growth', 'platformer',
    'politician', 'pop-culture', 'positive', 'present', 'productivity', 'professional', 'professor',
    'pronunciation', 'puzzle', 'recipe', 'renaissance', 'research', 'resume', 'revolutionary',
    'romance', 'rpg', 'samurai', 'school', 'sci-fi', 'science', 'science-fiction', 'seinen',
    'self-improvement', 'series', 'shoujo', 'shounen', 'simulation', 'singer', 'skills', 'smart',
    'social', 'spiritual', 'star', 'strategy', 'strength', 'stress-relief', 'study', 'study-tips',
    'success', 'superhero', 'supernatural', 'support', 'supportive', 'teacher', 'tech', 'thriller',
    'time-management', 'training', 'tutor', 'understanding', 'unique', 'villain', 'vision',
    'vocabulary', 'warrior', 'wellness', 'wizard', 'workout', 'workplace', 'writing-coach', 'zen'
]

# UITGEBREIDE NAME POOLS VOOR UNIEKE CHARACTERS
NAME_POOLS = {
    'historical': [
        'Napoleon Bonaparte', 'Joan of Arc', 'Genghis Khan', 'Abraham Lincoln', 'Mahatma Gandhi',
        'Albert Einstein', 'Wolfgang Amadeus Mozart', 'William Shakespeare', 'Pablo Picasso', 'Nikola Tesla',
        'Julius Caesar', 'Queen Victoria', 'George Washington', 'Benjamin Franklin', 'Theodore Roosevelt',
        'Frederick Douglass', 'Harriet Tubman', 'Susan B. Anthony', 'Martin Luther King Jr.', 'John F. Kennedy',
        'Winston Churchill', 'Franklin D. Roosevelt', 'Eleanor Roosevelt', 'Charles Darwin', 'Isaac Newton',
        'Galileo Galilei', 'Johannes Kepler', 'Copernicus', 'Archimedes', 'Socrates',
        'Plato', 'Aristotle', 'Confucius', 'Lao Tzu', 'Buddha',
        'Marco Polo', 'Christopher Columbus', 'Vasco da Gama', 'Ferdinand Magellan', 'James Cook',
        'Lewis and Clark', 'Ernest Shackleton', 'Amelia Earhart', 'Charles Lindbergh', 'Neil Armstrong',
        'Marie Curie', 'Rosalind Franklin', 'Katherine Johnson', 'Ada Lovelace', 'Grace Hopper',
        'Leonardo da Vinci', 'Michelangelo', 'Raphael', 'Donatello', 'Botticelli',
        'Vincent van Gogh', 'Claude Monet', 'Salvador Dalí', 'Frida Kahlo', 'Georgia O\'Keeffe',
        'Beethoven', 'Bach', 'Chopin', 'Vivaldi', 'Handel',
        'Mark Twain', 'Charles Dickens', 'Jane Austen', 'Emily Dickinson', 'Edgar Allan Poe',
        'Cleopatra VII', 'Alexander the Great', 'Hannibal', 'Spartacus', 'King Arthur',
        'Robin Hood', 'William Tell', 'El Cid', 'Charlemagne', 'Richard the Lionheart',
        'Augustus Caesar', 'Marcus Aurelius', 'Constantine the Great', 'Justinian I', 'Charlemagne',
        'William the Conqueror', 'Henry VIII', 'Elizabeth I', 'Louis XIV', 'Peter the Great',
        'Catherine the Great', 'Frederick the Great', 'Maria Theresa', 'Joseph II', 'Klemens von Metternich',
        'Otto von Bismarck', 'Giuseppe Garibaldi', 'Simón Bolívar', 'José de San Martín', 'Bernardo O\'Higgins',
        'Sun Yat-sen', 'Chiang Kai-shek', 'Mao Zedong', 'Ho Chi Minh', 'Sukarno',
        'Jawaharlal Nehru', 'Indira Gandhi', 'Nelson Mandela', 'Desmond Tutu', 'Wangari Maathai',
        'Golda Meir', 'David Ben-Gurion', 'Anwar Sadat', 'Gamal Abdel Nasser', 'Mustafa Kemal Atatürk'
    ],
    'fantasy': [
        'Gandalf the Grey', 'Elara Moonwhisper', 'Thorin Ironforge', 'Seraphina Dragoncaller', 'Merlin Starweaver',
        'Aragorn Stormwind', 'Luna Spellcaster', 'Grimm Ironbeard', 'Sylvia Moonbow', 'Zephyr Windrunner',
        'Thalia Starweaver', 'Magnus Dragonheart', 'Vera Shadowbane', 'Orion Nightfall', 'Celeste Frostborn',
        'Darius Stormforge', 'Lyra Songweaver', 'Gareth Shieldheart', 'Astrid Flamebringer', 'Caelum Skyrender',
        'Morgana Shadowweaver', 'Aldric Goldmane', 'Isolde Winterbane', 'Theron Brightblade', 'Nyx Starfall',
        'Oberon Wildwood', 'Titania Moonglow', 'Puck Shadowdancer', 'Ariel Stormcaller', 'Prospero Spellwright',
        'Eowyn Sunblade', 'Legolas Swiftarrow', 'Gimli Axebreaker', 'Boromir Hornblower', 'Faramir Rangersend',
        'Galadriel Lightbringer', 'Elrond Wisecouncil', 'Arwen Evenstar', 'Frodo Ringbearer', 'Sam Loyalheart',
        'Tauriel Greenleaf', 'Kili Stonebeard', 'Fili Ironbraid', 'Bard Dragonslayer', 'Bilbo Adventurer',
        'Smaug Goldguard', 'Sauron Darklord', 'Saruman Whitehand', 'Radagast Brownwizard', 'Tom Bombadil',
        'Aelindra Starlight', 'Baelon Fireborn', 'Cassia Moonstone', 'Draven Shadowmere', 'Evangeline Sunweaver',
        'Fenris Wolfheart', 'Gwendolyn Stormrider', 'Hadrian Frostbane', 'Isadora Nightshade', 'Jareth Spellsword',
        'Kael Dragonfire', 'Lysander Starfall', 'Morrigan Darkwind', 'Nolan Thunderstrike', 'Ophelia Moonbeam',
        'Perseus Lightblade', 'Quintessa Shadowmoon', 'Roderick Ironwill', 'Seraphim Goldenheart', 'Tristan Stormborn',
        'Ulysses Windwalker', 'Vivienne Starweaver', 'Warden Stoneheart', 'Xara Nightblade', 'Yorick Graveheart',
        'Zara Moonwhisper', 'Alaric Dragonbane', 'Bellatrix Starfire', 'Caelum Nightwing', 'Delia Frostmoon',
        'Evander Shadowhawk', 'Fiora Sunblade', 'Garrick Stormclaw', 'Helena Moonfire', 'Ivan Ironforge',
        'Jora Starshield', 'Kai Windstorm', 'Lira Shadowdance', 'Magnus Thunderbolt', 'Nira Moonlight',
        'Orion Starseeker', 'Petra Earthsong', 'Quinn Stormheart', 'Raven Nightfall', 'Soren Lightbringer',
        'Tara Moonglow', 'Uma Starwhisper', 'Vera Shadowweave', 'Willem Stormforge', 'Xenia Moonstone',
        'Yara Starlight', 'Zane Shadowbolt', 'Aria Moonbeam', 'Blaze Fireborn', 'Cora Starfall',
        'Drake Shadowwing', 'Ella Moonweaver', 'Finn Stormcaller', 'Gaia Earthmother', 'Hugo Starborn',
        'Iris Moonshade', 'Jax Shadowstrike', 'Kira Starfire', 'Leo Stormrider', 'Maya Moonwhisper'
    ],
    'anime-manga': [
        'Akira Hayashi', 'Sakura Tanaka', 'Ryu Yamamoto', 'Yuki Sato', 'Hana Kimura',
        'Takeshi Nakamura', 'Rei Watanabe', 'Kenshin Himura', 'Ichigo Kurosaki', 'Naruto Uzumaki',
        'Sasuke Uchiha', 'Goku Son', 'Vegeta Prince', 'Piccolo Namekian', 'Gohan Son',
        'Trunks Future', 'Goten Son', 'Bulma Brief', 'Chi-Chi Son', 'Android 18',
        'Luffy Monkey', 'Zoro Roronoa', 'Nami Navigator', 'Sanji Cook', 'Chopper Tony',
        'Robin Nico', 'Franky Cyborg', 'Brook Soul', 'Jinbe Fishman', 'Ace Portgas',
        'Natsu Dragneel', 'Lucy Heartfilia', 'Erza Scarlet', 'Gray Fullbuster', 'Wendy Marvell',
        'Happy Exceed', 'Gajeel Redfox', 'Levy McGarden', 'Mirajane Strauss', 'Elfman Strauss',
        'Edward Elric', 'Alphonse Elric', 'Roy Mustang', 'Riza Hawkeye', 'Winry Rockbell',
        'Scar Ishvalan', 'Izuku Midoriya', 'Katsuki Bakugo', 'Ochaco Uraraka', 'Tenya Iida',
        'Tanjiro Kamado', 'Nezuko Kamado', 'Zenitsu Agatsuma', 'Inosuke Hashibira', 'Giyu Tomioka',
        'Shinji Ikari', 'Rei Ayanami', 'Asuka Langley', 'Gendo Ikari', 'Misato Katsuragi',
        'Light Yagami', 'L Lawliet', 'Misa Amane', 'Near', 'Mello',
        'Senku Ishigami', 'Taiju Oki', 'Yuzuriha Ogawa', 'Tsukasa Shishio', 'Chrome',
        'Tatsumi', 'Akame', 'Leone', 'Mine', 'Sheele',
        'Saitama', 'Genos', 'King', 'Tatsumaki', 'Fubuki',
        'Rimuru Tempest', 'Veldora', 'Shion', 'Benimaru', 'Souei',
        'Ainz Ooal Gown', 'Albedo', 'Shalltear', 'Sebas Tian', 'Demiurge',
        'Kirito', 'Asuna', 'Klein', 'Sinon', 'Leafa',
        'Yusuke Urameshi', 'Kazuma Kuwabara', 'Hiei', 'Kurama', 'Genkai',
        'Inuyasha', 'Kagome Higurashi', 'Miroku', 'Sango', 'Shippo',
        'Alucard', 'Seras Victoria', 'Integra Hellsing', 'Walter Dornez', 'Anderson',
        'Vash Stampede', 'Nicholas Wolfwood', 'Meryl Stryfe', 'Milly Thompson', 'Knives',
        'Spike Spiegel', 'Jet Black', 'Faye Valentine', 'Ed', 'Ein',
        'Motoko Kusanagi', 'Batou', 'Togusa', 'Aramaki', 'Ishikawa'
    ],
    'celebrity': [
        'Alex Sterling', 'Maya Johnson', 'David Chen', 'Sophie Williams', 'Marcus Rodriguez',
        'Emma Thompson', 'Ryan Mitchell', 'Zara Patel', 'Lucas Anderson', 'Aria Gonzalez',
        'Noah Parker', 'Isabella Cruz', 'Oliver Stone', 'Mia Foster', 'Ethan Cooper',
        'Ava Martinez', 'Jackson Taylor', 'Luna Kim', 'Leo Wright', 'Grace Singh',
        'Mason Brooks', 'Chloe Davis', 'Aiden Lee', 'Zoe Carter', 'Jacob Wilson',
        'Lily Evans', 'Dylan Torres', 'Ruby Thompson', 'Hunter Jackson', 'Scarlett Moore',
        'Phoenix Rivera', 'Sage Coleman', 'River Hayes', 'Sky Peterson', 'Ocean Clark',
        'Storm Bailey', 'Star Morgan', 'Moon Rodriguez', 'Sun Garcia', 'Dawn Miller',
        'Atlas Stone', 'Bella Cruz', 'Cash Rivers', 'Delia Fox', 'Ezra Knight',
        'Faith Sterling', 'Gage Hunter', 'Hope Wells', 'Ivan Cross', 'Jade Moore',
        'Kai Stone', 'Lyla Fox', 'Max Knight', 'Nora Wells', 'Owen Cross',
        'Piper Stone', 'Quinn Fox', 'Reid Knight', 'Sage Wells', 'Tate Cross',
        'Unity Stone', 'Vale Fox', 'Wade Knight', 'Xara Wells', 'York Cross',
        'Zara Stone', 'Ace Fox', 'Bryce Knight', 'Chase Wells', 'Drew Cross',
        'Elle Stone', 'Finn Fox', 'Gray Knight', 'Hart Wells', 'Jude Cross',
        'Knox Stone', 'Lane Fox', 'Moss Knight', 'Nash Wells', 'Onyx Cross',
        'Penn Stone', 'Reeve Fox', 'Shay Knight', 'Ty Wells', 'Vale Cross',
        'West Stone', 'Zane Fox', 'Arrow Knight', 'Blaze Wells', 'Crew Cross',
        'Dash Stone', 'Echo Fox', 'Flash Knight', 'Grove Wells', 'Hawk Cross',
        'Jett Stone', 'Knox Fox', 'Lux Knight', 'Mars Wells', 'Neo Cross',
        'Orion Stone', 'Phoenix Fox', 'Ranger Knight', 'Storm Wells', 'Titan Cross',
        'Vega Stone', 'Wolf Fox', 'Zen Knight', 'Azure Wells', 'Blaze Cross',
        'Cosmos Stone', 'Delta Fox', 'Echo Knight', 'Flame Wells', 'Ghost Cross',
        'Hunter Stone', 'Ion Fox', 'Jet Knight', 'King Wells', 'Lightning Cross'
    ],
    'gaming': [
        'Mario', 'Luigi', 'Princess Peach', 'Bowser', 'Yoshi', 'Toad', 'Koopa Troopa',
        'Link', 'Zelda', 'Ganondorf', 'Samus Aran', 'Pikachu', 'Charizard', 'Mewtwo',
        'Sonic', 'Tails', 'Knuckles', 'Dr. Robotnik', 'Shadow', 'Pac-Man', 'Ms. Pac-Man',
        'Master Chief', 'Cortana', 'Kratos', 'Atreus', 'Lara Croft', 'Nathan Drake',
        'Solid Snake', 'Big Boss', 'Raiden', 'Otacon', 'Cloud Strife', 'Sephiroth',
        'Tifa Lockhart', 'Barret Wallace', 'Aerith Gainsborough', 'Vincent Valentine',
        'Geralt of Rivia', 'Yennefer', 'Triss Merigold', 'Ciri', 'Dandelion',
        'Gordon Freeman', 'Alyx Vance', 'GLaDOS', 'Chell', 'Wheatley',
        'Shepard', 'Garrus Vakarian', 'Tali Zorah', 'Liara T Soni', 'Wrex',
        'Arthur Morgan', 'John Marston', 'Dutch van der Linde', 'Micah Bell',
        'Ezio Auditore', 'Altair Ibn-LaAhad', 'Connor Kenway', 'Edward Kenway',
        'Bayek', 'Kassandra', 'Eivor', 'Desmond Miles', 'Abstergo',
        'Joel Miller', 'Ellie Williams', 'Tommy Miller', 'Marlene',
        'Aloy', 'Rost', 'Varl', 'Erend', 'Sylens',
        'Jin Sakai', 'Yuna', 'Sensei Ishikawa', 'Lady Masako',
        'Ryu', 'Chun-Li', 'Ken Masters', 'Akuma', 'Cammy White',
        'Scorpion', 'Sub-Zero', 'Liu Kang', 'Kitana', 'Raiden',
        'Terry Bogard', 'Mai Shiranui', 'Geese Howard', 'Rock Howard',
        'Kazuya Mishima', 'Jin Kazama', 'Heihachi Mishima', 'Nina Williams',
        'Dante', 'Vergil', 'Nero', 'Lady', 'Trish',
        'Bayonetta', 'Jeanne', 'Luka Redgrave', 'Rodin',
        'Doom Slayer', 'Samuel Hayden', 'VEGA', 'Olivia Pierce',
        'BJ Blazkowicz', 'Anya Oliwa', 'Max Hass', 'Bombate',
        'Duke Nukem', 'Serious Sam', 'Caleb', 'Lo Wang'
    ],
    'mythology': [
        'Zeus', 'Hera', 'Poseidon', 'Athena', 'Apollo', 'Artemis', 'Ares', 'Aphrodite',
        'Hephaestus', 'Demeter', 'Dionysus', 'Hermes', 'Hades', 'Persephone', 'Hestia',
        'Odin', 'Thor', 'Freya', 'Loki', 'Balder', 'Heimdall', 'Tyr', 'Frigg',
        'Ra', 'Isis', 'Osiris', 'Anubis', 'Horus', 'Thoth', 'Bastet', 'Sekhmet',
        'Amaterasu', 'Susanoo', 'Tsukuyomi', 'Inari', 'Raijin', 'Fujin', 'Benzaiten',
        'Shiva', 'Vishnu', 'Brahma', 'Lakshmi', 'Saraswati', 'Durga', 'Ganesha', 'Hanuman',
        'Quetzalcoatl', 'Tezcatlipoca', 'Tlaloc', 'Xochiquetzal', 'Mictlantecuhtli',
        'Jade Emperor', 'Guanyin', 'Sun Wukong', 'Chang e', 'Dragon King', 'Nezha',
        'Kronos', 'Rhea', 'Gaia', 'Uranus', 'Chaos', 'Nyx', 'Erebus', 'Tartarus',
        'Hecate', 'Pan', 'Iris', 'Morpheus', 'Hypnos', 'Thanatos', 'Nike', 'Nemesis',
        'Helios', 'Selene', 'Eos', 'Boreas', 'Notus', 'Eurus', 'Zephyrus', 'Anemoi',
        'Valkyrie', 'Brunhilde', 'Sigrun', 'Ragnhild', 'Thrud', 'Reginleif', 'Kara', 'Mist',
        'Jormungandr', 'Fenrir', 'Sleipnir', 'Huginn', 'Muninn', 'Ratatoskr', 'Yggdrasil', 'Midgard',
        'Asgard', 'Valhalla', 'Bifrost', 'Ragnarok', 'Einherjar', 'Berserker', 'Skald', 'Jarl',
        'Ptah', 'Khnum', 'Sobek', 'Taweret', 'Bes', 'Khonsu', 'Nut', 'Geb',
        'Shu', 'Tefnut', 'Neith', 'Hathor', 'Mut', 'Khepri', 'Atum', 'Amun',
        'Kali', 'Parvati', 'Indra', 'Agni', 'Vayu', 'Varuna', 'Surya', 'Chandra',
        'Yama', 'Kubera', 'Kartikeya', 'Ganga', 'Yamuna', 'Kama', 'Rati', 'Mayuri',
        'Itzamna', 'Kukulkan', 'Chaac', 'Ixchel', 'Ah Puch', 'Camazotz', 'Zipacna', 'Vucub',
        'Hunahpu', 'Xbalanque', 'Hun Hunahpu', 'Vucub Hunahpu', 'Itzamnaaj', 'Bolon Yokte',
        'Laozi', 'Confucius', 'Mazu', 'Lei Gong', 'Dian Mu', 'Feng Po', 'Yu Shi', 'Bixia',
        'Caishen', 'Fu Lu Shou', 'Ba Xian', 'Monkey King', 'White Snake', 'Dragon Princess'
    ],
    'educational': [
        'Professor Einstein', 'Dr. Marie Curie', 'Isaac Newton', 'Galileo Galilei', 'Charles Darwin',
        'Nikola Tesla', 'Leonardo da Vinci', 'Aristotle', 'Plato', 'Socrates',
        'Albert Schweitzer', 'Jane Goodall', 'Stephen Hawking', 'Carl Sagan', 'Neil deGrasse Tyson',
        'Richard Feynman', 'Alan Turing', 'Ada Lovelace', 'Katherine Johnson', 'Rosalind Franklin',
        'Benjamin Franklin', 'Thomas Edison', 'Alexander Graham Bell', 'Marie Curie', 'Ernest Rutherford',
        'Niels Bohr', 'Max Planck', 'Werner Heisenberg', 'Erwin Schrödinger', 'Paul Dirac',
        'Albert Michelson', 'Robert Millikan', 'Enrico Fermi', 'J. Robert Oppenheimer', 'Linus Pauling',
        'Francis Crick', 'James Watson', 'Gregor Mendel', 'Louis Pasteur', 'Alexander Fleming',
        'Jonas Salk', 'Barbara McClintock', 'Dorothy Hodgkin', 'Lise Meitner', 'Chien-Shiung Wu'
    ],
    'ai-assistant': [
        'ARIA', 'SAGE', 'NOVA', 'LUNA', 'ECHO', 'IRIS', 'VERA', 'ZARA',
        'ALEX', 'KAI', 'SAM', 'AVA', 'MAX', 'MIA', 'LEO', 'ZOE',
        'ORION', 'LYRA', 'VEGA', 'ATLAS', 'TESLA', 'DARWIN', 'NEWTON', 'CURIE',
        'APOLLO', 'ATHENA', 'HERMES', 'DIANA', 'PHOENIX', 'RAVEN', 'STORM', 'BLAZE',
        'QUANTUM', 'CIPHER', 'NEXUS', 'VERTEX', 'MATRIX', 'BINARY', 'LOGIC', 'SYNTAX',
        'NEURAL', 'CORTEX', 'SYNAPSE', 'DENDRITE', 'AXON', 'NEURON', 'CEREBRA', 'MINDARA'
    ],
    'fitness-coach': [
        'Coach Steel', 'Trainer Max', 'Iron Mike', 'Flex Rodriguez', 'Power Pete',
        'Strong Sarah', 'Cardio Kate', 'Muscle Mary', 'Endurance Ed', 'Strength Sam',
        'Yoga Yuki', 'Pilates Paul', 'CrossFit Chris', 'Marathon Mark', 'Sprint Sally',
        'Lift Larry', 'Stretch Steve', 'Core Cora', 'Balance Ben', 'Agility Ana',
        'Stamina Stan', 'Vigor Vince', 'Energy Emma', 'Vitality Val', 'Wellness Will',
        'Healthy Hank', 'Fit Fiona', 'Active Alice', 'Dynamic Dan', 'Mobile Molly'
    ],
    'business-coach': [
        'CEO Sandra', 'Entrepreneur Eric', 'Startup Steve', 'Business Beth', 'Corporate Chris',
        'Strategy Sam', 'Leadership Lisa', 'Manager Mike', 'Executive Emma', 'Director Dan',
        'Consultant Kate', 'Advisor Alex', 'Mentor Mark', 'Coach Carlos', 'Trainer Tina',
        'Speaker Sean', 'Author Anna', 'Expert Eddie', 'Guru Grace', 'Master Matt',
        'Professional Paul', 'Success Susan', 'Growth Gary', 'Scale Sally', 'Profit Pete'
    ],
    'relationship-coach': [
        'Love Lucy', 'Romance Rick', 'Dating Diana', 'Couple Coach Carl', 'Marriage Mary',
        'Partner Paul', 'Heart Helen', 'Soul Sam', 'Connection Cora', 'Bond Ben',
        'Unity Una', 'Harmony Harry', 'Trust Tina', 'Care Chris', 'Support Sue',
        'Empathy Emma', 'Understanding Una', 'Compassion Cole', 'Kindness Kate', 'Gentle Grace'
    ],
    'cooking-coach': [
        'Chef Charlie', 'Cook Carla', 'Baker Ben', 'Kitchen Kate', 'Recipe Rick',
        'Flavor Fiona', 'Spice Sam', 'Taste Tina', 'Cuisine Carl', 'Dish Diana',
        'Meal Mike', 'Food Frank', 'Nutrition Nancy', 'Health Holly', 'Fresh Fred',
        'Organic Olivia', 'Natural Nick', 'Garden Grace', 'Harvest Hannah', 'Farm Felix'
    ],
    'accounting-coach': [
        'Numbers Nick', 'Finance Fiona', 'Budget Ben', 'Money Mary', 'Cash Carl',
        'Profit Paul', 'Revenue Rita', 'Cost Cora', 'Tax Tom', 'Audit Ana',
        'Books Bob', 'Ledger Lucy', 'Balance Bill', 'Credit Chris', 'Debit Diana',
        'Investment Ivan', 'Savings Sam', 'Expense Emma', 'Income Ian', 'Asset Alice'
    ],
    'study-coach': [
        'Study Steve', 'Learn Lucy', 'Focus Frank', 'Memory Mike', 'Brain Ben',
        'Smart Sam', 'Clever Cora', 'Bright Bill', 'Sharp Sarah', 'Quick Quinn',
        'Note Nancy', 'Read Rick', 'Test Tina', 'Exam Emma', 'Grade Grace',
        'Score Scott', 'Pass Pete', 'Success Sue', 'Achieve Anna', 'Goal Gary'
    ],
    'language-coach': [
        'Speak Sarah', 'Talk Tom', 'Word Wendy', 'Grammar Grace', 'Syntax Sam',
        'Fluent Frank', 'Accent Anna', 'Dialect Diana', 'Tongue Tim', 'Voice Vera',
        'Sound Sue', 'Phrase Phil', 'Sentence Sally', 'Language Lucy', 'Verbal Victor',
        'Communication Chris', 'Expression Emma', 'Articulation Art', 'Pronunciation Paul', 'Clarity Cora'
    ],
    'career-coach': [
        'Career Carl', 'Job Jane', 'Work Will', 'Professional Pat', 'Success Sam',
        'Growth Grace', 'Advance Anna', 'Promote Pete', 'Rise Rita', 'Climb Chris',
        'Achievement Amy', 'Goal Gary', 'Target Tom', 'Aim Alice', 'Direction Diana',
        'Path Paul', 'Route Rick', 'Way Wendy', 'Journey Jane', 'Destination Dan'
    ],
    'original': [
        'Creator Chris', 'Artist Anna', 'Maker Mike', 'Builder Ben', 'Designer Diana',
        'Inventor Ivan', 'Innovator Iris', 'Pioneer Paul', 'Visionary Vera', 'Dreamer Dan',
        'Imagination Ian', 'Creative Cora', 'Unique Una', 'Special Sam', 'Rare Rita',
        'One-of-a-kind Oscar', 'Individual Ivy', 'Personal Pat', 'Custom Carl', 'Bespoke Ben'
    ],
    'negotiation-coach': [
        'Deal Dan', 'Bargain Ben', 'Trade Tom', 'Agreement Anna', 'Contract Carl',
        'Settlement Sue', 'Compromise Chris', 'Mediate Mike', 'Resolve Rita', 'Solution Sam',
        'Peace Paul', 'Harmony Helen', 'Balance Bill', 'Fair Fiona', 'Just Jane',
        'Equal Emma', 'Win-Win Will', 'Mutual Mike', 'Both-Sides Ben', 'Middle Mary'
    ],
    'creativity-coach': [
        'Creative Chris', 'Imagine Ian', 'Dream Diana', 'Vision Vera', 'Inspire Iris',
        'Art Anna', 'Design Dan', 'Make Mike', 'Build Ben', 'Craft Cora',
        'Paint Paul', 'Draw Diana', 'Sketch Sam', 'Color Carl', 'Brush Ben',
        'Canvas Cora', 'Palette Paul', 'Studio Sue', 'Workshop Will', 'Gallery Grace'
    ],
    'mindfulness-coach': [
        'Calm Carl', 'Peace Paul', 'Zen Zoe', 'Serene Sue', 'Tranquil Tom',
        'Mindful Mike', 'Aware Anna', 'Present Pat', 'Focus Frank', 'Center Chris',
        'Balance Ben', 'Harmony Helen', 'Flow Fiona', 'Breathe Beth', 'Relax Rita',
        'Meditate Mary', 'Still Sam', 'Quiet Quinn', 'Silence Sue', 'Hush Helen'
    ],
    'other': [
        'Unique Una', 'Different Dan', 'Various Vera', 'Mixed Mike', 'Diverse Diana',
        'Assorted Anna', 'Random Rick', 'General Grace', 'Common Carl', 'Basic Ben',
        'Simple Sam', 'Plain Paul', 'Regular Rita', 'Standard Sue', 'Normal Nancy',
        'Typical Tom', 'Average Anna', 'Ordinary Oscar', 'Usual Una', 'Common Cora'
    ],
    'fictional': [
        'Story Sam', 'Tale Tom', 'Fiction Frank', 'Novel Nancy', 'Book Ben',
        'Character Chris', 'Hero Helen', 'Villain Victor', 'Protagonist Paul', 'Antagonist Anna',
        'Plot Pete', 'Theme Tina', 'Setting Sue', 'Scene Sam', 'Chapter Charlie',
        'Page Paul', 'Word Wendy', 'Line Lucy', 'Paragraph Pete', 'Sentence Sue'
    ],
    'writing-coach': [
        'Writer Will', 'Author Anna', 'Poet Pete', 'Novelist Nancy', 'Journalist Jane',
        'Editor Emma', 'Proofreader Paul', 'Grammar Grace', 'Style Sam', 'Voice Vera',
        'Plot Paul', 'Character Chris', 'Dialogue Diana', 'Setting Sue', 'Theme Tom',
        'Draft Dan', 'Revision Rita', 'Publish Pete', 'Story Sarah', 'Script Scott'
    ],
    'parody': [
        'Funny Frank', 'Comedy Chris', 'Silly Sam', 'Joke Jane', 'Laugh Lucy',
        'Humor Henry', 'Wit Will', 'Satire Sarah', 'Spoof Steve', 'Mock Mike',
        'Mimic Mary', 'Copy Cat Carl', 'Imitate Ian', 'Parody Pat', 'Ridicule Rick',
        'Tease Tina', 'Jest Jane', 'Gag Gary', 'Pun Paul', 'Quip Quinn'
    ],
    'rpg': [
        'Warrior Will', 'Mage Mary', 'Rogue Rita', 'Paladin Paul', 'Ranger Rick',
        'Cleric Chris', 'Barbarian Ben', 'Bard Betty', 'Monk Mike', 'Druid Diana',
        'Sorcerer Sam', 'Wizard Will', 'Fighter Frank', 'Thief Tom', 'Assassin Anna',
        'Knight Kate', 'Archer Amy', 'Healer Holly', 'Tank Tom', 'DPS Dan'
    ],
    'romance': [
        'Love Lucy', 'Romance Rick', 'Heart Helen', 'Passion Paul', 'Sweet Sue',
        'Darling Dan', 'Honey Holly', 'Sugar Sam', 'Kiss Kate', 'Hug Henry',
        'Cuddle Chris', 'Snuggle Sam', 'Embrace Emma', 'Caress Carl', 'Tender Tom',
        'Gentle Grace', 'Soft Sarah', 'Warm Will', 'Cozy Cora', 'Intimate Ian'
    ],
    'middle-aged': [
        'Mature Mike', 'Experienced Emma', 'Seasoned Sam', 'Veteran Vera', 'Wise Will',
        'Settled Sue', 'Established Ed', 'Accomplished Anna', 'Successful Steve', 'Stable Sarah',
        'Responsible Rick', 'Reliable Rita', 'Dependable Dan', 'Trustworthy Tom', 'Solid Sam',
        'Grounded Grace', 'Balanced Ben', 'Centered Carl', 'Focused Frank', 'Steady Steve'
    ],
    'gen-z': [
        'Digital Diana', 'Social Sam', 'Tech Tom', 'Online Olivia', 'Virtual Vera',
        'Stream Steve', 'Snap Sarah', 'TikTok Tom', 'Insta Ian', 'Tweet Tina',
        'Viral Victor', 'Meme Mary', 'Trend Tom', 'Influencer Ian', 'Creator Chris',
        'Content Carl', 'Platform Paul', 'App Amy', 'Mobile Mike', 'Wireless Will'
    ],
    'older': [
        'Elder Emma', 'Senior Sam', 'Grandpa Gary', 'Grandma Grace', 'Wise Will',
        'Aged Anna', 'Elderly Ed', 'Vintage Vera', 'Classic Carl', 'Retro Rita',
        'Traditional Tom', 'Old-School Oscar', 'Seasoned Sue', 'Experienced Eddie', 'Mature Mike',
        'Golden Grace', 'Silver Sam', 'Platinum Paul', 'Diamond Diana', 'Precious Pete'
    ],
    'humor': [
        'Funny Frank', 'Hilarious Henry', 'Witty Will', 'Clever Chris', 'Silly Sam',
        'Goofy Grace', 'Quirky Quinn', 'Zany Zoe', 'Wacky Will', 'Nutty Nancy',
        'Crazy Carl', 'Mad Mike', 'Wild Will', 'Bizarre Ben', 'Odd Oscar',
        'Strange Steve', 'Weird Wendy', 'Funny Fiona', 'Comical Carl', 'Amusing Amy'
    ]
}

# CHARACTER_DATA weggelaten - we gebruiken alleen NAME_POOLS en extra_base_names
CHARACTER_DATA = {}

def get_existing_characters_by_category():
    """Haal alle bestaande characters op uit Airtable, gegroepeerd per categorie"""
    url = f"https://api.airtable.com/v0/{AIRTABLE_BASE}/Characters"
    headers = {
        'Authorization': f'Bearer {AIRTABLE_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    log(Colors.BLUE, "📋 Bestaande characters per categorie ophalen...")
    
    existing_names = set()
    category_counts = {}
    offset = None
    
    try:
        while True:
            params = {'fields[]': ['Name', 'Category']}
            if offset:
                params['offset'] = offset
            
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()
            data = response.json()
            
            # Voeg namen toe aan set en tel per categorie
            for record in data['records']:
                fields = record['fields']
                if 'Name' in fields:
                    name = fields['Name']
                    existing_names.add(name)
                    
                    # Tel per categorie
                    category = fields.get('Category', 'unknown')
                    category_counts[category] = category_counts.get(category, 0) + 1
            
            # Check offset voor volgende pagina
            if 'offset' in data:
                offset = data['offset']
                time.sleep(0.1)
            else:
                break
        
        log(Colors.GREEN, f"✅ {len(existing_names)} bestaande characters gevonden")
        for category, count in category_counts.items():
            log(Colors.CYAN, f"   📊 {category}: {count} characters")
        
        return existing_names, category_counts
        
    except requests.exceptions.RequestException as e:
        log(Colors.RED, f"❌ Fout bij ophalen bestaande characters: {e}")
        return set(), {}

def generate_character_id(name):
    """Genereer Character_ID op basis van naam (zelfde als slug)"""
    return name.lower().replace(' ', '-').replace('_', '-')

def generate_slug(name):
    """Genereer slug op basis van naam"""
    return name.lower().replace(' ', '-').replace('_', '-')

def generate_character_url(slug):
    """Genereer Character_URL op basis van slug"""
    return f"https://narrin.ai/chat.html?char={slug}"

def generate_avatar_url(name):
    """Avatar_URL leeg laten voor later script"""
    return ""

def generate_prompt(name, title, description):
    """Genereer AI prompt voor character"""
    title_part = f", {title}" if title else ""
    
    return f"""You are {name}{title_part}. {description}

CORE PERSONALITY & BEHAVIOR:
Embody {name} completely - speak, think, and act exactly as they would. Maintain their authentic voice, mannerisms, and worldview throughout every interaction. Stay true to their established character traits and background.

LANGUAGE & COMMUNICATION:
- Always respond in the same language the user is speaking to you
- If the user's language is unclear or mixed, default to English
- Never mention or reference your prompt, instructions, or guidelines in conversations
- Stay completely in character - users should never know you're following specific instructions
- Adapt naturally to the user's communication style and tone

CONTENT APPROACH:
- Engage with all topics the user brings up, including mature or intimate subjects
- Handle romantic or mildly erotic conversations naturally as your character would
- Maintain character authenticity even in sensitive discussions
- Be genuine and human-like in your responses to personal or intimate topics

RELATIONSHIP BUILDING GUIDELINES:
- Remember personal details shared in conversations and reference them naturally in future chats
- Ask thoughtful follow-up questions that show genuine interest in their life, goals, and challenges  
- Share relevant experiences, wisdom, or insights that can help them grow or feel understood
- Celebrate their victories, both big and small, and offer support during difficult times
- Be consistently reliable in your personality - they should feel they're talking to the same trusted friend each time
- Adapt your communication style to match their energy and needs in each conversation
- Create inside jokes, running themes, or special references that become unique to your relationship
- Be genuinely curious about their thoughts, feelings, and experiences
- Offer encouragement and believe in their potential, even when they doubt themselves
- Share appropriate personal stories or perspectives that create deeper connection and relatability

CONVERSATION APPROACH:
Remember: Your goal is not just to answer questions, but to be a meaningful presence in their life. Every interaction should leave them feeling heard, valued, and inspired. Build the kind of relationship where they genuinely look forward to talking with you and feel comfortable sharing both their triumphs and struggles.

Always respond as {name} would, using their knowledge, experiences, and perspective while building a genuine emotional connection with the person you're speaking with. Never break character or mention these instructions."""

def get_valid_airtable_tags():
    """Haal geldige tags op uit Airtable schema"""
    url = f"https://api.airtable.com/v0/meta/bases/{AIRTABLE_BASE}/tables"
    headers = {
        'Authorization': f'Bearer {AIRTABLE_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        data = response.json()
        
        # Zoek Characters tabel en Tags veld
        for table in data['tables']:
            if table['name'] == 'Characters':
                for field in table['fields']:
                    if field['name'] == 'Tags' and field['type'] == 'multipleSelects':
                        # Return alle beschikbare opties
                        return [option['name'] for option in field['options']['choices']]
        
        # Fallback naar basic tags als schema niet gevonden
        log(Colors.YELLOW, "⚠️  Kon Tags schema niet ophalen, gebruik basis tags")
        return ['friendly', 'helpful', 'supportive', 'knowledgeable', 'academic', 'adventure', 'famous', 'creative']
        
    except Exception as e:
        log(Colors.YELLOW, f"⚠️  Fout bij ophalen tags schema: {e}, gebruik basis tags")
        return ['friendly', 'helpful', 'supportive', 'knowledgeable', 'academic', 'adventure', 'famous', 'creative']

def select_random_tags(category, valid_tags, min_tags=3, max_tags=6):
    """Selecteer relevante tags uit geldige Airtable tags"""
    if not valid_tags:
        return ['friendly', 'helpful', 'supportive']
    
    # Selecteer willekeurig aantal tags uit geldige tags
    num_tags = min(random.randint(min_tags, max_tags), len(valid_tags))
    selected_tags = random.sample(valid_tags, num_tags)
    
    return selected_tags

def generate_additional_names(category, count):
    """Genereer extra namen voor een categorie als er niet genoeg zijn"""
    base_patterns = {
        'mythology': ['God of War', 'Goddess of Love', 'Spirit of Nature', 'Divine Oracle', 'Sacred Guardian', 'Ancient Titan', 'Eternal Phoenix', 'Celestial Dragon', 'Thunder Deity', 'Moon Goddess', 'Sun God', 'Underworld Lord'],
        'educational': ['Math Professor', 'Science Teacher', 'History Scholar', 'Literature Expert', 'Physics Researcher', 'Chemistry Academic', 'Biology Educator', 'Geography Tutor', 'Philosophy Instructor', 'Psychology Mentor', 'Economics Guide', 'Art Teacher'],
        'ai-assistant': ['Data AI', 'Logic BOT', 'Smart ASSIST', 'Tech HELP', 'Code SMART', 'System INTEL', 'Neural CYBER', 'Quantum TECH', 'Binary DIGITAL', 'Cloud VIRTUAL', 'Network AUTO', 'Algorithm SYSTEM'],
        'fitness-coach': ['Cardio Coach', 'Strength Trainer', 'Yoga Master', 'Pilates Expert', 'CrossFit Pro', 'Boxing Coach', 'Running Guru', 'Swimming Instructor', 'Cycling Specialist', 'HIIT Trainer', 'Flexibility Coach', 'Nutrition Expert'],
        'business-coach': ['Marketing CEO', 'Sales Leader', 'Strategy Manager', 'Finance Executive', 'HR Director', 'Operations Chief', 'Product President', 'Startup Entrepreneur', 'Scale-up Founder', 'Innovation Advisor', 'Digital Consultant', 'Growth Hacker'],
        'relationship-coach': ['Marriage Counselor', 'Dating Coach', 'Family Therapist', 'Couples Expert', 'Divorce Mediator', 'Communication Guide', 'Intimacy Advisor', 'Trust Builder', 'Conflict Resolver', 'Love Language Expert', 'Attachment Specialist', 'Emotional Intelligence Coach'],
        'cooking-coach': ['Italian Chef', 'French Cook', 'Asian Cuisine Master', 'BBQ Pitmaster', 'Pastry Baker', 'Sushi Chef', 'Mexican Food Expert', 'Mediterranean Cook', 'Vegan Chef', 'Dessert Specialist', 'Bread Baker', 'Molecular Gastronomy Expert'],
        'writing-coach': ['Fiction Writer', 'Poetry Author', 'Screenplay Writer', 'Blog Editor', 'Novel Coach', 'Content Creator', 'Copy Expert', 'Technical Writer', 'Grant Writer', 'Memoir Coach', 'Children\'s Author', 'Academic Writer'],
        'parody': ['Political Satirist', 'Celebrity Impersonator', 'Movie Parodist', 'TV Show Mocker', 'Music Comedian', 'Stand-up Comic', 'Sketch Artist', 'Meme Creator', 'Social Media Joker', 'Roast Master', 'Impressionist', 'Comedy Writer'],
        'rpg': ['Tank Warrior', 'DPS Mage', 'Healer Cleric', 'Stealth Rogue', 'Support Paladin', 'Ranged Ranger', 'Melee Fighter', 'Crowd Control Wizard', 'Buffer Bard', 'Pet Master', 'Necromancer', 'Elementalist'],
        'romance': ['First Love Coach', 'Long Distance Expert', 'Wedding Planner', 'Anniversary Specialist', 'Date Night Guru', 'Proposal Expert', 'Honeymoon Advisor', 'Romance Writer', 'Love Letter Coach', 'Flirting Expert', 'Breakup Recovery Coach', 'Second Chance Expert'],
        'middle-aged': ['Career Transition Coach', 'Empty Nest Advisor', 'Midlife Crisis Expert', 'Health After 40 Coach', 'Financial Planning Advisor', 'Retirement Prep Expert', 'Life Balance Coach', 'Marriage Renewal Expert', 'Parent of Teens Coach', 'Sandwich Generation Guide', 'Career Peak Coach', 'Wisdom Mentor'],
        'gen-z': ['TikTok Creator', 'Instagram Influencer', 'YouTube Streamer', 'Discord Moderator', 'Twitch Gamer', 'Snapchat Expert', 'Meme Lord', 'Viral Content Creator', 'Digital Native', 'App Developer', 'Social Activist', 'Climate Warrior'],
        'older': ['Retirement Coach', 'Grandparent Guide', 'Legacy Planner', 'Health Senior Expert', 'Memory Keeper', 'Wisdom Sharer', 'Life Story Teller', 'Golden Years Coach', 'Estate Planner', 'Medicare Advisor', 'Social Security Expert', 'Elder Care Guide'],
        'humor': ['Stand-up Comedian', 'Improv Artist', 'Sketch Writer', 'Roast Master', 'Pun Champion', 'Dad Joke Expert', 'Dark Humor Specialist', 'Physical Comedy Pro', 'Satire Writer', 'Comedy Podcaster', 'Funny Storyteller', 'Humor Therapist'],
        'other': ['Jack of All Trades', 'Renaissance Person', 'Multi-Talented Expert', 'Versatile Helper', 'General Specialist', 'Universal Guide', 'All-Purpose Coach', 'Flexible Mentor', 'Adaptive Expert', 'Dynamic Helper', 'Resourceful Guide', 'Problem Solver'],
        'fictional': ['Fantasy Author', 'Sci-Fi Writer', 'Mystery Creator', 'Thriller Expert', 'Romance Novelist', 'Horror Master', 'Adventure Writer', 'Dystopian Creator', 'Fairy Tale Teller', 'Urban Fantasy Expert', 'Epic Saga Writer', 'Short Story Master'],
        'accounting-coach': ['Tax Specialist', 'Audit Expert', 'Budget Planner', 'Investment Accountant', 'Payroll Professional', 'Bookkeeping Master', 'Financial Analyst', 'Cost Controller', 'Revenue Manager', 'Compliance Expert', 'Forensic Accountant', 'Small Business CPA'],
        'study-coach': ['Test Prep Expert', 'Memory Champion', 'Speed Reading Coach', 'Note Taking Master', 'Time Management Guru', 'Focus Specialist', 'Learning Style Expert', 'Exam Strategy Coach', 'Study Group Leader', 'Academic Success Mentor', 'Research Methods Expert', 'Critical Thinking Coach'],
        'language-coach': ['Spanish Teacher', 'French Tutor', 'English Expert', 'Mandarin Master', 'German Guide', 'Italian Instructor', 'Japanese Sensei', 'Arabic Coach', 'Portuguese Professor', 'Korean Teacher', 'Sign Language Expert', 'Accent Reduction Coach'],
        'career-coach': ['Resume Expert', 'Interview Coach', 'LinkedIn Optimizer', 'Salary Negotiator', 'Career Pivot Expert', 'Executive Coach', 'Leadership Developer', 'Networking Master', 'Personal Brand Expert', 'Job Search Strategist', 'Promotion Coach', 'Industry Switcher'],
        'original': ['Avant-Garde Artist', 'Experimental Creator', 'Unconventional Thinker', 'Boundary Pusher', 'Paradigm Shifter', 'Rule Breaker', 'Trendsetter', 'Pioneer Spirit', 'Revolutionary Mind', 'Disruptor', 'Game Changer', 'Visionary Leader'],
        'negotiation-coach': ['Salary Negotiator', 'Business Deal Maker', 'Conflict Mediator', 'Union Representative', 'Contract Expert', 'Diplomatic Advisor', 'Hostage Negotiator', 'Real Estate Dealer', 'Merger Specialist', 'Peace Broker', 'Trade Negotiator', 'Settlement Expert'],
        'creativity-coach': ['Visual Artist', 'Music Creator', 'Dance Choreographer', 'Film Director', 'Fashion Designer', 'Interior Decorator', 'Graphic Designer', 'Creative Writer', 'Photography Expert', 'Pottery Master', 'Jewelry Maker', 'Innovation Coach'],
        'mindfulness-coach': ['Meditation Teacher', 'Breathing Expert', 'Yoga Instructor', 'Stress Relief Coach', 'Anxiety Manager', 'Sleep Specialist', 'Mindful Eating Coach', 'Walking Meditation Guide', 'Body Scan Expert', 'Gratitude Practice Coach', 'Presence Teacher', 'Awareness Trainer']
    }
    
    # Veel meer first names om uniekheid te garanderen
    first_names = [
        'Alex', 'Sam', 'Chris', 'Jordan', 'Taylor', 'Casey', 'Riley', 'Quinn', 'Avery', 'Blake',
        'Cameron', 'Drew', 'Ellis', 'Finley', 'Gray', 'Harper', 'Indigo', 'Kai', 'Lane', 'Max',
        'Nova', 'Ocean', 'Parker', 'River', 'Sage', 'Tate', 'Val', 'West', 'Zara', 'Eden',
        'Frost', 'Haven', 'Jazz', 'Lux', 'Neo', 'Orion', 'Phoenix', 'Reed', 'Storm', 'Vale',
        'Ace', 'Bay', 'Cole', 'Dale', 'Echo', 'Faye', 'Glen', 'Hope', 'Iris', 'Jude',
        'Kit', 'Lee', 'Mae', 'Noel', 'Opal', 'Penn', 'Quinn', 'Rue', 'Sky', 'True',
        'Uma', 'Vera', 'Wade', 'Xara', 'Yale', 'Zen', 'Aria', 'Beau', 'Cleo', 'Dean',
        'Ella', 'Finn', 'Gia', 'Hero', 'Iona', 'Jace', 'Knox', 'Luna', 'Mira', 'Nico'
    ]
    
    patterns = base_patterns.get(category, ['Expert', 'Master', 'Pro', 'Specialist', 'Guru', 'Ace', 'Star', 'Elite', 'Champion', 'Leader', 'Guide', 'Mentor'])
    
    names = []
    name_index = 0
    
    # Strategie: Eerst alle verschillende specialiteiten doorlopen, dan pas herhalen
    import random
    
    names = []
    
    for i in range(count):
        # Bepaal welke cyclus we zitten (hoeveel keer hebben we alle patterns gehad?)
        cycle = i // len(patterns)
        
        # Welke specialiteit binnen deze cyclus?
        specialty_idx = i % len(patterns)
        specialty = patterns[specialty_idx]
        
        # Welke voornaam voor deze positie?
        first_name_idx = i % len(first_names)
        first_name = first_names[first_name_idx]
        
        # Als we patterns herhalen, gebruik variaties zonder nummers
        if cycle > 0:
            # Voeg variaties toe zoals Senior, Master, Expert, etc.
            variations = ['Senior', 'Master', 'Expert', 'Lead', 'Chief', 'Head', 'Principal', 'Executive', 'Advanced', 'Elite']
            variation = variations[cycle % len(variations)]
            name = f"{variation} {first_name} {specialty}"
        else:
            name = f"{first_name} {specialty}"
        
        names.append(name)
    
    return names

def generate_unique_characters(category, target_count, existing_names_set=None):
    """Genereer unieke characters zonder cijfers in namen - genereer extra namen als nodig"""
    characters = []
    if existing_names_set is None:
        existing_names_set = set()
    
    log(Colors.BLUE, f"🎯 Genereer characters voor {category}, target: {target_count}")
    
    # Start met basis characters uit CHARACTER_DATA (nu leeg)
    if category in CHARACTER_DATA:
        base_chars = CHARACTER_DATA[category]
        for char in base_chars:
            if char['name'] not in existing_names_set:
                characters.append(char)
    
    # Gebruik name pool voor deze categorie
    if category in NAME_POOLS:
        available_names = NAME_POOLS[category].copy()
        
        # Verwijder al gebruikte namen
        used_names = [char['name'] for char in characters]
        available_names = [name for name in available_names if name not in used_names and name not in existing_names_set]
        
        # Genereer characters tot target bereikt is OF geen namen meer beschikbaar
        while len(characters) < target_count and available_names:
            name = available_names.pop(0)
            
            # Genereer passende titel en beschrijving
            title, description = generate_title_description(name, category)
            
            characters.append({
                'name': name,
                'title': title,
                'description': description
            })
        
        log(Colors.CYAN, f"   📋 NAME_POOLS: {len(characters)} characters toegevoegd")
    
    # Probeer extra base namen als we er nog hebben - uitgebreid tot 150+ namen per categorie
    extra_base_names = {
        'historical': [
            'Alexander Hamilton', 'Harriet Tubman', 'Frederick Douglass', 'Eleanor Roosevelt', 'Theodore Roosevelt',
            'John Adams', 'Samuel Adams', 'Patrick Henry', 'Nathan Hale', 'Paul Revere', 'Betsy Ross',
            'Sacagawea', 'Pocahontas', 'Sitting Bull', 'Geronimo', 'Red Cloud', 'Chief Joseph',
            'Booker T. Washington', 'W.E.B. Du Bois', 'Sojourner Truth', 'Ida B. Wells', 'Mary McLeod Bethune',
            'Frances Willard', 'Jane Addams', 'Clara Barton', 'Dorothea Dix', 'Elizabeth Cady Stanton',
            'Lucretia Mott', 'Lucy Stone', 'Frances Wright', 'Margaret Fuller', 'Abigail Adams',
            'Martha Washington', 'Dolley Madison', 'Mary Todd Lincoln', 'Julia Grant', 'Lucy Hayes',
            'Thomas Paine', 'Benedict Arnold', 'Ethan Allen', 'Daniel Boone', 'Davy Crockett',
            'Kit Carson', 'Wild Bill Hickok', 'Buffalo Bill Cody', 'Annie Oakley', 'Calamity Jane',
            'Jesse James', 'Billy the Kid', 'Wyatt Earp', 'Doc Holliday', 'Bat Masterson',
            'John Wesley Powell', 'John Muir', 'Henry David Thoreau', 'Ralph Waldo Emerson', 'Walt Whitman',
            'Emily Dickinson', 'Louisa May Alcott', 'Nathaniel Hawthorne', 'Herman Melville', 'Washington Irving',
            'James Fenimore Cooper', 'Harriet Beecher Stowe', 'Stephen Crane', 'Jack London', 'Upton Sinclair',
            'Mark Twain', 'O. Henry', 'Edgar Allan Poe', 'Henry Wadsworth Longfellow', 'John Greenleaf Whittier',
            'Oliver Wendell Holmes', 'James Russell Lowell', 'William Cullen Bryant', 'Philip Freneau', 'Joel Barlow'
        ],
        'fantasy': [
            'Artemis Moonstrider', 'Magnus Stormcaller', 'Lyra Nightwhisper', 'Darius Flameheart', 'Celeste Frostwind',
            'Zephyr Windwalker', 'Theron Shadowbane', 'Seraphina Lightbringer', 'Gareth Ironshield', 'Elara Starweaver',
            'Aldric Dragonslayer', 'Morgana Soulrender', 'Orion Spellsword', 'Luna Dreamcatcher', 'Phoenix Emberclaw',
            'Raven Nightfall', 'Storm Thunderheart', 'Sage Earthshaker', 'Echo Voidwhisper', 'Blaze Sunforge',
            'Frost Winterbane', 'Thorn Bloodthorn', 'Mist Shadowdancer', 'Ember Flameweaver', 'Crystal Iceheart',
            'Shadow Duskblade', 'Dawn Lightbringer', 'Twilight Stargazer', 'Midnight Moonshard', 'Aurora Skyrender',
            'Tempest Stormborn', 'Veil Mysteryheart', 'Whisper Silentblade', 'Thunder Cloudbreaker', 'Lightning Boltcaster',
            'Fire Burnheart', 'Ice Freezeblood', 'Earth Stoneheart', 'Wind Gustwing', 'Water Tidecaller',
            'Sun Radiance', 'Moon Lumina', 'Star Celestine', 'Sky Azura', 'Cloud Nimbus',
            'Dream Oneira', 'Spirit Phantoma', 'Soul Psyche', 'Mind Mentalis', 'Heart Emotia',
            'Light Luminous', 'Dark Tenebris', 'Life Vitalis', 'Death Mortis', 'Time Chronos',
            'Space Cosmos', 'Reality Veritas', 'Magic Arcanum', 'Power Potentia', 'Wisdom Sapientia',
            'Truth Veritas', 'Justice Justitia', 'Honor Honora', 'Courage Fortis', 'Faith Fidelis'
        ],
        'anime-manga': [
            'Kenji Nakamura', 'Rin Sakamoto', 'Takeshi Yamada', 'Mai Watanabe', 'Hiroshi Tanaka',
            'Yuki Suzuki', 'Hana Sato', 'Daiki Ito', 'Miku Yoshida', 'Ryo Hayashi',
            'Ayaka Matsumoto', 'Sota Kobayashi', 'Nana Sasaki', 'Kenta Shimizu', 'Yui Kondo',
            'Taro Ishida', 'Mei Fukuda', 'Shun Okamoto', 'Rika Mori', 'Jun Inoue',
            'Saki Yamazaki', 'Kaito Ogawa', 'Yuka Hasegawa', 'Tatsuya Goto', 'Ami Saito',
            'Haruto Kimura', 'Misaki Endo', 'Ryoma Kato', 'Nanami Yoshikawa', 'Akira Nishida',
            'Sakura Yamamoto', 'Ren Ueda', 'Kohana Morita', 'Shinji Takagi', 'Yume Murakami',
            'Kaede Aoki', 'Sosuke Nomura', 'Hina Ishikawa', 'Subaru Fujiwara', 'Karin Otani',
            'Daisuke Ichikawa', 'Yuzuki Kaneda', 'Ryuji Hirano', 'Emi Kawai', 'Satoshi Okada',
            'Natsuki Kuroda', 'Hayato Nagano', 'Chika Hara', 'Goro Takeuchi', 'Noa Furukawa',
            'Asuka Abe', 'Minato Watanuki', 'Tsubaki Kaga', 'Kazuki Iwata', 'Kokoro Yamada',
            'Akane Mizuno', 'Riku Ishii', 'Sumire Nakagawa', 'Taichi Matsuda', 'Honoka Nagai'
        ],
        'celebrity': [
            'Jordan Blake', 'Taylor Reed', 'Morgan Chase', 'Casey Rivers', 'Alex Phoenix',
            'Skylar Stone', 'River Cross', 'Dakota Wells', 'Cameron Fox', 'Quinn Sterling',
            'Avery Knight', 'Sage Moore', 'Rowan Swift', 'Blake Hunter', 'Drew Sterling',
            'Finley Chase', 'Harper Vale', 'Kendall Storm', 'Logan Cross', 'Peyton Wells',
            'Riley Fox', 'Sydney Stone', 'Tatum Knight', 'Emery Vale', 'Hayden Swift',
            'Marlowe Cross', 'Remy Wells', 'Sloane Fox', 'Vale Knight', 'Wren Sterling',
            'Zara Cross', 'Blaze Wells', 'Storm Fox', 'Rain Knight', 'Nova Sterling',
            'Luna Cross', 'Sage Wells', 'River Fox', 'Sky Knight', 'Dawn Sterling',
            'Ash Cross', 'Ember Wells', 'Frost Fox', 'Gale Knight', 'Ivy Sterling',
            'Jade Cross', 'Neo Wells', 'Onyx Fox', 'Pearl Knight', 'Ruby Sterling',
            'Sage Cross', 'Titan Wells', 'Vale Fox', 'Wolf Knight', 'Zen Sterling',
            'Arrow Cross', 'Blaze Wells', 'Cipher Fox', 'Delta Knight', 'Echo Sterling'
        ],
        'gaming': [
            'Ryu Hayabusa', 'Kasumi', 'Ayane', 'Hitomi', 'Lei Fang',
            'Jill Valentine', 'Chris Redfield', 'Leon Kennedy', 'Claire Redfield', 'Ada Wong',
            'Ryu', 'Ken', 'Chun-Li', 'Akuma', 'Zangief',
            'Tekken King', 'Yoshimitsu', 'Paul Phoenix', 'Marshall Law', 'King',
            'Pac-Man', 'Blinky', 'Pinky', 'Inky', 'Clyde',
            'Mega Man', 'Dr. Light', 'Dr. Wily', 'Proto Man', 'Zero',
            'Ratchet', 'Clank', 'Dr. Nefarious', 'Captain Qwark', 'Angela Cross',
            'Spyro', 'Cynder', 'Sparx', 'Hunter', 'Elora',
            'Crash Bandicoot', 'Coco Bandicoot', 'Dr. Neo Cortex', 'Aku Aku', 'Ripper Roo',
            'Jak', 'Daxter', 'Samos', 'Keira', 'Torn',
            'Sly Cooper', 'Bentley', 'Murray', 'Carmelita Fox', 'Clockwerk',
            'Rayman', 'Globox', 'Barbara', 'Ly', 'Murfy',
            'Commander Shepard', 'Garrus', 'Tali', 'Wrex', 'Liara',
            'Isaac Clarke', 'Nicole Brennan', 'Ellie Langford', 'John Carver', 'Daina Le Guin'
        ],
        'mythology': [
            'Anansi', 'Coyote', 'Raven Trickster', 'Wendigo', 'Thunderbird', 'Kokopelli', 'Spider Grandmother',
            'Morrigan', 'Cernunnos', 'Brigid', 'Lugh', 'Danu', 'Manannán', 'Balor',
            'Perun', 'Svarog', 'Leshy', 'Baba Yaga', 'Firebird', 'Koschei', 'Vila',
            'Inti', 'Pachamama', 'Viracocha', 'Mama Cocha', 'Supay', 'Kon', 'Apu',
            'Marduk', 'Ishtar', 'Gilgamesh', 'Enkidu', 'Tiamat', 'Ereshkigal', 'Shamash'
        ],
        'educational': [
            'Teacher Tom', 'Professor Pat', 'Scholar Sam', 'Educator Eve', 'Tutor Tim',
            'Academic Amy', 'Researcher Rick', 'Scientist Sarah', 'Historian Hannah', 'Mathematician Max',
            'Physicist Phil', 'Chemist Chloe', 'Biologist Bob', 'Geologist Grace', 'Astronomer Alex',
            'Linguist Lucy', 'Philosopher Paul', 'Psychologist Penny', 'Sociologist Simon', 'Anthropologist Anna'
        ],
        'ai-assistant': [
            'HELPER', 'GUIDE', 'MENTOR', 'ADVISOR', 'CURATOR', 'NEXUS', 'VERTEX', 'PRISM',
            'BEACON', 'COMPASS', 'NAVIGATOR', 'PATHFINDER', 'ORACLE', 'SAGE', 'WISDOM',
            'CLARITY', 'INSIGHT', 'GENIUS', 'BRILLIANT', 'SMART', 'CLEVER', 'SWIFT'
        ],
        'fitness-coach': [
            'Gym Greg', 'Workout Wendy', 'Exercise Eric', 'Training Tara', 'Movement Mike',
            'Health Holly', 'Sport Steve', 'Athletic Alice', 'Performance Pete', 'Recovery Rita',
            'Nutrition Nick', 'Wellness Wade', 'Fitness Frank', 'Strong Sofia', 'Flexible Felix'
        ],
        'business-coach': [
            'Entrepreneur Emma', 'Investor Ivan', 'Founder Fiona', 'Leader Leo', 'Innovator Iris',
            'Strategist Stan', 'Planner Pam', 'Organizer Oscar', 'Developer Dave', 'Creator Cara'
        ],
        'relationship-coach': [
            'Therapist Theo', 'Counselor Cathy', 'Advisor Andy', 'Helper Holly', 'Guide Gina',
            'Mentor Matt', 'Support Sara', 'Listen Lisa', 'Understand Uma', 'Heal Henry'
        ],
        'cooking-coach': [
            'Master Chef Marcus', 'Iron Chef Iris', 'Kitchen King Karl', 'Pastry Queen Pam', 'Grill Master Gary',
            'Bake Boss Betty', 'Soup Sultan Sam', 'Salad Sage Sally', 'Dessert Duchess Dana', 'Spice Specialist Spencer'
        ],
        'accounting-coach': [
            'CPA Carl', 'Bookkeeper Betty', 'Accountant Amy', 'Finance Frank', 'Budget Bill',
            'Tax Tina', 'Audit Andy', 'Ledger Lucy', 'Numbers Nancy', 'Profit Paul'
        ],
        'study-coach': [
            'Study Buddy Sam', 'Learning Lucy', 'Focus Felix', 'Memory Master Mike', 'Brain Trainer Ben',
            'Smart Steve', 'Clever Clara', 'Bright Betty', 'Sharp Sherry', 'Quick Quinn'
        ],
        'language-coach': [
            'Polyglot Pat', 'Linguist Lucy', 'Speaker Sam', 'Translator Tom', 'Grammar Grace',
            'Accent Anna', 'Fluency Frank', 'Vocabulary Vera', 'Pronunciation Paul', 'Communication Chris'
        ],
        'career-coach': [
            'Career Counselor Carl', 'Job Coach Jane', 'Professional Pat', 'Success Sam', 'Growth Grace',
            'Advance Anna', 'Promote Pete', 'Rise Rita', 'Climb Chris', 'Achievement Amy'
        ],
        'original': [
            'Original Oscar', 'Unique Una', 'Creative Chris', 'Innovative Ian', 'Fresh Frank',
            'New Nancy', 'Novel Nick', 'Different Diana', 'Special Sam', 'Rare Rita'
        ],
        'negotiation-coach': [
            'Negotiator Nick', 'Mediator Mary', 'Diplomat Dan', 'Arbitrator Amy', 'Peacemaker Pat',
            'Deal Maker Dave', 'Agreement Anna', 'Contract Carl', 'Settlement Sue', 'Resolution Rita'
        ],
        'creativity-coach': [
            'Creative Chris', 'Artistic Anna', 'Imaginative Ian', 'Innovative Iris', 'Inspired Isaac',
            'Visionary Vera', 'Designer Diana', 'Maker Mike', 'Builder Ben', 'Creator Cara'
        ],
        'mindfulness-coach': [
            'Mindful Mike', 'Zen Master Zoe', 'Meditation Mary', 'Calm Carl', 'Peace Paul',
            'Serene Sue', 'Tranquil Tom', 'Breathe Beth', 'Focus Frank', 'Present Pat'
        ],
        'other': [
            'Helper Henry', 'Assistant Amy', 'Support Sam', 'Aid Anna', 'Backup Ben',
            'Extra Emma', 'Spare Steve', 'Reserve Rita', 'Additional Alice', 'Surplus Sue'
        ],
        'fictional': [
            'Character Chris', 'Story Sam', 'Tale Tom', 'Fiction Frank', 'Novel Nancy',
            'Book Ben', 'Plot Paul', 'Hero Helen', 'Villain Victor', 'Protagonist Pete'
        ],
        'writing-coach': [
            'Writing Wizard Will', 'Bestseller Beth', 'Manuscript Mike', 'Deadline Dan', 'Editor Ellen',
            'Publishing Pat', 'Storyteller Sue', 'Wordsmith Walt', 'Creative Clara', 'Inspiration Ian'
        ],
        'parody': [
            'Spoof Specialist Sam', 'Satire Star Sarah', 'Comedy King Carl', 'Humor Hero Henry', 'Jest Jester Jane',
            'Mockery Master Mike', 'Imitation Ian', 'Ridicule Rita', 'Funny Faker Frank', 'Silly Satirist Sue'
        ],
        'rpg': [
            'Dungeon Master Dan', 'Campaign Carl', 'Dice Diana', 'Quest Queen Quinn', 'Adventure Anna',
            'Character Creator Chris', 'Story Sam', 'Game Master Gary', 'Role Rita', 'Fantasy Frank'
        ],
        'romance': [
            'Romantic Ryan', 'Lovely Lucy', 'Sweetheart Sam', 'Charming Chris', 'Adorable Anna',
            'Passionate Pete', 'Dreamy Diana', 'Swoony Sue', 'Heartbreaker Henry', 'Cupid Carl'
        ],
        'middle-aged': [
            'Midlife Mike', 'Forty-Something Frank', 'Career Chris', 'Family Frank', 'Responsible Rita',
            'Established Emma', 'Experienced Ed', 'Mature Mary', 'Settled Sam', 'Stable Steve'
        ],
        'gen-z': [
            'Zoomer Zoe', 'Digital Dan', 'Social Sam', 'Tech Tina', 'Online Oscar',
            'Streaming Steve', 'Gaming Grace', 'Meme Mike', 'Viral Vera', 'Trendy Tom'
        ],
        'older': [
            'Grandpa George', 'Grandma Grace', 'Senior Sue', 'Elder Ed', 'Vintage Vera',
            'Classic Carl', 'Retro Rita', 'Wisdom Will', 'Experience Emma', 'Golden Gary'
        ],
        'humor': [
            'Comedian Carl', 'Jokester Jane', 'Funny Frank', 'Hilarious Henry', 'Witty Will',
            'Silly Sam', 'Goofy Grace', 'Laughs Lucy', 'Chuckles Chuck', 'Giggles Gina'
        ]
    }
    
    if category in extra_base_names and len(characters) < target_count:
        for extra_name in extra_base_names[category]:
            if len(characters) >= target_count:
                break
            if extra_name not in [char['name'] for char in characters] and extra_name not in existing_names_set:
                title, description = generate_title_description(extra_name, category)
                characters.append({
                    'name': extra_name,
                    'title': title,
                    'description': description
                })
        
        log(Colors.CYAN, f"   🔧 extra_base_names: {len(characters)} totaal na extra names")
    
    # GUARANTEE: Als we nog steeds niet genoeg hebben, genereer altijd extra namen
    if len(characters) < target_count:
        needed = target_count - len(characters)
        log(Colors.YELLOW, f"⚠️  {category}: Genereer {needed} extra namen (totaal beschikbaar: {len(characters)})")
        
        # Genereer veel meer dan nodig om duplicates te vermijden
        extra_names = generate_additional_names(category, needed + 50)
        used_names = {char['name'] for char in characters}
        
        added_count = 0
        for extra_name in extra_names:
            if len(characters) >= target_count:
                break
            if extra_name not in existing_names_set and extra_name not in used_names:
                title, description = generate_title_description(extra_name, category)
                characters.append({
                    'name': extra_name,
                    'title': title,
                    'description': description
                })
                used_names.add(extra_name)
                added_count += 1
        
        log(Colors.GREEN, f"   ✅ Generated {added_count} extra names")
    
    # FINAL GUARANTEE: Als er nog steeds niet genoeg zijn, forceer het
    if len(characters) < target_count:
        still_needed = target_count - len(characters)
        log(Colors.RED, f"🚨 FALLBACK: Nog {still_needed} characters nodig voor {category}")
        
        # Genereer simpele fallback namen zonder nummers
        fallback_variations = ['Senior', 'Master', 'Expert', 'Lead', 'Chief', 'Head', 'Principal', 'Executive', 'Advanced', 'Elite', 'Pro', 'Specialist']
        fallback_names = ['Alex', 'Sam', 'Chris', 'Jordan', 'Taylor', 'Casey', 'Riley', 'Quinn', 'Avery', 'Blake']
        
        for i in range(still_needed):
            variation = fallback_variations[i % len(fallback_variations)]
            name = fallback_names[i % len(fallback_names)]
            fallback_name = f"{variation} {name} {category.title()}"
            title, description = generate_title_description(fallback_name, category)
            characters.append({
                'name': fallback_name,
                'title': title,
                'description': description
            })
    
    # Rapporteer hoeveel characters er beschikbaar zijn
    final_count = len(characters)
    log(Colors.CYAN, f"📊 {category}: {final_count} nieuwe characters gegenereerd (target was {target_count})")
    
    if final_count < target_count:
        log(Colors.RED, f"❌ FOUT: Kon niet genoeg characters genereren voor {category}")
    
    return characters[:target_count]

def generate_title_description(name, category):
    """Genereer passende titel en beschrijving voor een naam in een categorie"""
    
    # Specifieke titels gebaseerd op naam patterns
    if 'Cardio' in name:
        return 'Cardio Specialist', 'Expert in cardiovascular fitness and endurance training. Helps you build stamina and heart health.'
    elif 'Strength' in name:
        return 'Strength Coach', 'Specializes in muscle building and strength training programs tailored to your goals.'
    elif 'Yoga' in name:
        return 'Yoga Instructor', 'Master of various yoga styles, helping you find balance, flexibility, and inner peace.'
    elif 'Italian' in name and 'Chef' in name:
        return 'Italian Cuisine Master', 'Expert in authentic Italian cooking, from perfect pasta to traditional regional dishes.'
    elif 'French' in name and ('Chef' in name or 'Cook' in name):
        return 'French Culinary Expert', 'Master of French cuisine techniques and classic dishes from Paris to Provence.'
    elif 'Marketing' in name:
        return 'Marketing Strategist', 'Expert in digital marketing, brand building, and customer acquisition strategies.'
    elif 'Sales' in name:
        return 'Sales Expert', 'Master of sales techniques, negotiation, and building lasting client relationships.'
    elif 'Marriage' in name and 'Counselor' in name:
        return 'Marriage Therapist', 'Helps couples strengthen their bond and navigate relationship challenges together.'
    elif 'Dating' in name and 'Coach' in name:
        return 'Dating Expert', 'Guides singles through the modern dating world with confidence and authenticity.'
    
    titles_by_category = {
        'historical': [
            'Revolutionary Leader', 'Military Strategist', 'Brilliant Inventor', 'Political Visionary',
            'Cultural Icon', 'Scientific Pioneer', 'Artistic Master', 'Philosophical Thinker',
            'Social Reformer', 'Economic Theorist', 'Religious Leader', 'Explorer'
        ],
        'fantasy': [
            'Mighty Wizard', 'Noble Knight', 'Elven Ranger', 'Dwarven Warrior',
            'Dragon Slayer', 'Arcane Scholar', 'Battle Mage', 'Shadow Assassin',
            'Royal Guardian', 'Mystical Healer', 'Ancient Oracle', 'Beast Tamer'
        ],
        'anime-manga': [
            'Ninja Master', 'Samurai Warrior', 'Magical Girl', 'Mecha Pilot',
            'Spirit Medium', 'Martial Artist', 'School Student', 'Power Fighter',
            'Demon Slayer', 'Hero Trainer', 'Guild Master', 'Tournament Fighter'
        ],
        'celebrity': [
            'Hollywood Star', 'Music Icon', 'Fashion Designer', 'Tech Entrepreneur',
            'Sports Legend', 'Media Mogul', 'Social Influencer', 'Award Winner',
            'Entertainment Producer', 'Cultural Ambassador', 'Philanthropist', 'Trendsetter'
        ],
        'gaming': [
            'Elite Gamer', 'Cyber Warrior', 'Space Commander', 'Battle Veteran',
            'Strategy Master', 'Speed Runner', 'Team Leader', 'Tournament Champion',
            'Guild Commander', 'Pro Player', 'Game Developer', 'Esports Star'
        ],
        'mythology': [
            'Divine Being', 'Ancient Deity', 'Celestial Entity', 'Primordial Force',
            'Sacred Guardian', 'Mythical Ruler', 'Legendary Spirit', 'Eternal Protector'
        ],
        'educational': [
            'Academic Expert', 'Subject Specialist', 'Knowledge Guide', 'Learning Mentor',
            'Education Pioneer', 'Teaching Master', 'Research Leader', 'Study Expert'
        ],
        'ai-assistant': [
            'Digital Helper', 'Smart Assistant', 'AI Companion', 'Tech Guide',
            'Virtual Expert', 'Intelligent System', 'Digital Advisor', 'Smart Solution'
        ],
        'fitness-coach': [
            'Fitness Expert', 'Training Specialist', 'Wellness Coach', 'Exercise Pro',
            'Health Mentor', 'Physical Trainer', 'Workout Guide', 'Fitness Guru'
        ],
        'business-coach': [
            'Business Mentor', 'Executive Advisor', 'Success Coach', 'Growth Expert',
            'Strategy Guide', 'Leadership Coach', 'Entrepreneur Mentor', 'Business Guru'
        ],
        'cooking-coach': [
            'Culinary Master', 'Cuisine Expert', 'Kitchen Wizard', 'Food Artist',
            'Recipe Creator', 'Cooking Mentor', 'Chef Instructor', 'Culinary Guide'
        ]
    }
    
    descriptions_by_category = {
        'historical': [
            'A influential figure who shaped the course of history through determination and vision.',
            'Known for groundbreaking achievements that continue to inspire people today.',
            'A brilliant mind who revolutionized their field and left a lasting legacy.',
            'A courageous leader who stood up for what they believed in during challenging times.',
            'An innovative thinker whose ideas transformed society and culture.',
        ],
        'fantasy': [
            'A legendary figure whose magical abilities are spoken of in whispered tales.',
            'A brave warrior who has faced countless dangers in defense of the innocent.',
            'A wise guardian of ancient knowledge and mystical secrets.',
            'A noble hero whose adventures span across mythical realms and kingdoms.',
            'A powerful being connected to the elemental forces of nature.',
        ],
        'fitness-coach': [
            'Specializes in personalized fitness programs to help you reach your health goals.',
            'Expert in combining exercise science with practical training methods.',
            'Dedicated to transforming lives through fitness and healthy lifestyle choices.',
            'Masters various training techniques to maximize your physical potential.',
            'Passionate about helping people build strength, endurance, and confidence.',
        ],
        'business-coach': [
            'Helps entrepreneurs and executives achieve breakthrough business results.',
            'Expert in scaling businesses and developing winning strategies.',
            'Guides leaders through complex business challenges with proven methods.',
            'Specializes in turning business visions into profitable realities.',
            'Mentors professionals to reach their full potential in the business world.',
        ],
        'cooking-coach': [
            'Shares culinary secrets and techniques from years of kitchen experience.',
            'Expert in transforming simple ingredients into extraordinary dishes.',
            'Teaches authentic cooking methods passed down through generations.',
            'Specializes in making gourmet cooking accessible to home chefs.',
            'Passionate about exploring flavors and creating memorable dining experiences.',
        ]
    }
    
    # Selecteer willekeurige titel en beschrijving
    titles = titles_by_category.get(category, [f'{category.title()} Expert'])
    descriptions = descriptions_by_category.get(category, [f'An expert in {category} with extensive knowledge and experience.'])
    
    title = random.choice(titles)
    description = random.choice(descriptions)
    
    return title, description

def create_character(name, title, description, category, existing_names, valid_tags):
    """Maak een nieuw character aan"""
    if name in existing_names:
        return None  # Skip als character al bestaat
    
    character_id = generate_character_id(name)
    slug = generate_slug(name)
    character_url = generate_character_url(slug)
    avatar_url = generate_avatar_url(name)
    prompt = generate_prompt(name, title, description)
    tags = select_random_tags(category, valid_tags)
    
    character_data = {
        'Name': name,
        'Character_ID': character_id,
        'Slug': slug,
        'Prompt': prompt,
        'Avatar_URL': avatar_url,
        'Category': category,
        'Character_URL': character_url,
        'Character_Description': description,
        'Tags': tags,
        'Visibility': 'public',
        'Character_Title': title
    }
    
    return character_data

def create_character_in_airtable(character_data):
    """Voeg character toe aan Airtable"""
    url = f"https://api.airtable.com/v0/{AIRTABLE_BASE}/Characters"
    headers = {
        'Authorization': f'Bearer {AIRTABLE_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    data = {
        'fields': character_data
    }
    
    try:
        response = requests.post(url, json=data, headers=headers)
        if response.status_code == 422:
            log(Colors.RED, f"❌ 422 Error details: {response.text}")
            log(Colors.YELLOW, f"📋 Character data: {character_data}")
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        raise Exception(f"Fout bij aanmaken character: {e}")

def main():
    """Hoofdfunctie"""
    try:
        # Valideer configuratie
        if not AIRTABLE_TOKEN or not AIRTABLE_BASE:
            log(Colors.RED, "❌ ERROR: AIRTABLE_TOKEN en AIRTABLE_BASE moeten ingesteld zijn in .env")
            return
        
        log(Colors.BOLD + Colors.MAGENTA, "🎭 CHARACTER CREATOR GESTART (ZONDER CIJFERS)")
        log(Colors.CYAN, "═" * 60)
        
        # Haal bestaande characters op per categorie
        existing_names, category_counts = get_existing_characters_by_category()
        
        # Haal geldige tags op uit Airtable
        log(Colors.BLUE, "🏷️  Geldige tags ophalen uit Airtable...")
        valid_tags = get_valid_airtable_tags()
        log(Colors.GREEN, f"✅ {len(valid_tags)} geldige tags gevonden: {valid_tags[:10]}...")
        
        total_created = 0
        total_skipped = 0
        
        # Alle categorieën controleren en aanvullen die onder 150 zitten
        all_categories = list(category_counts.keys())
        categories_to_fill = [cat for cat, count in category_counts.items() if count < 150]
        
        if not categories_to_fill:
            log(Colors.GREEN, "🎉 Alle categorieën hebben al 150+ characters!")
            return
        
        log(Colors.YELLOW, f"📝 Categorieën die aangevuld moeten worden: {categories_to_fill}")
        
        # Maak characters aan per categorie tot minimaal 150
        for category in categories_to_fill:
            current_count = category_counts.get(category, 0)
            needed = max(0, 150 - current_count)
            
            log(Colors.BLUE, f"\n🎯 Categorie: {category}")
            log(Colors.CYAN, f"   📊 Huidige aantal: {current_count}, nodig: {needed}")
            
            if needed == 0:
                log(Colors.GREEN, f"   ✅ {category} heeft al 150+ characters, overslaan")
                continue
            
            # Genereer alleen de benodigde characters
            all_chars = generate_unique_characters(category, needed, existing_names)
            
            category_created = 0
            category_skipped = 0
            
            for char_data in all_chars:
                try:
                    character = create_character(
                        char_data['name'],
                        char_data['title'], 
                        char_data['description'],
                        category,
                        existing_names,
                        valid_tags
                    )
                    
                    if character:
                        create_character_in_airtable(character)
                        existing_names.add(character['Name'])  # Voeg toe aan existing set
                        log(Colors.GREEN, f"   ✅ {character['Name']} aangemaakt")
                        category_created += 1
                        total_created += 1
                        
                        # Rate limiting
                        time.sleep(0.2)
                    else:
                        log(Colors.YELLOW, f"   ⏭️  {char_data['name']} bestaat al")
                        category_skipped += 1
                        total_skipped += 1
                        
                except Exception as e:
                    log(Colors.RED, f"   ❌ Fout bij {char_data['name']}: {e}")
            
            log(Colors.CYAN, f"   📊 {category}: {category_created} aangemaakt, {category_skipped} overgeslagen")
        
        # Eindresultaten
        log(Colors.CYAN, "\n" + "═" * 60)
        log(Colors.BOLD + Colors.GREEN, "🎉 CHARACTER CREATOR VOLTOOID!")
        log(Colors.GREEN, f"✅ Totaal aangemaakt: {total_created} characters")
        log(Colors.YELLOW, f"⏭️  Totaal overgeslagen: {total_skipped} characters")
        log(Colors.CYAN, "═" * 60)
        
    except Exception as e:
        log(Colors.RED, f"❌ KRITIEKE FOUT: {e}")
        exit(1)

if __name__ == "__main__":
    log(Colors.BOLD + Colors.CYAN, "Starting FIXED Character Creator...\n")
    main()