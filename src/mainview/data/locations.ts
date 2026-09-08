/**
 * Structured location data for cascading Country -> State/Wilaya -> City selection
 */

export interface LocationData {
	[country: string]: {
		[state: string]: string[];
	};
}

export const LOCATION_DATA: LocationData = {
	Algeria: {
		"01 - Adrar": ["Adrar", "Tamest", "Charouine", "Reggane", "In Zghmir", "Tit", "Zaouiet Kounta", "Aoulef", "Timokten"],
		"02 - Chlef": ["Chlef", "Ténès", "Boukadir", "Oued Fodda", "El Karimia", "Taougrite", "Beni Haoua", "Sobha", "Zeboudja", "Ouled Fares"],
		"03 - Laghouat": ["Laghouat", "Ksar El Hirane", "Sidi Makhlouf", "Hassi Delaa", "Aflou", "Ain Madhi", "Gueltat Sidi Saad", "El Ghicha"],
		"04 - Oum El Bouaghi": ["Oum El Bouaghi", "Ain Beida", "Ain M'lila", "Ain Fakroun", "Ain Kercha", "Meskiana", "Sigus"],
		"05 - Batna": ["Batna", "Barika", "Ain Touta", "Arris", "Merouana", "N'Gaous", "Ras El Aioun", "Tazoult", "Chemora"],
		"06 - Béjaïa": ["Béjaïa", "Amizour", "Akbou", "Seddouk", "Sidi Aïch", "El Kseur", "Tazmalt", "Aokas", "Souk El Ténine", "Kherrata", "Adekar"],
		"07 - Biskra": ["Biskra", "Tolga", "Sidi Okba", "Ouled Djellal", "Zeribet El Oued", "El Kantara", "M'Chouneche", "Foughala"],
		"08 - Béchar": ["Béchar", "Kenadsa", "Abadla", "Beni Ounif", "Taghit", "Tabelbala", "Igli"],
		"09 - Blida": ["Blida", "Boufarik", "Mouzaia", "Ouled Yaich", "El Affroun", "Larbaa", "Bougara", "Meftah", "Chebli", "Oued Alleug"],
		"10 - Bouira": ["Bouira", "Lakhdaria", "Sour El Ghozlane", "Ain Bessem", "M'Chedallah", "Bir Ghbalou", "Kadiria", "Bechloul"],
		"11 - Tamanrasset": ["Tamanrasset", "Abalessa", "In Ghar", "Idles", "Tazrouk"],
		"12 - Tébessa": ["Tébessa", "Cheria", "El Aouinet", "El Kouif", "Bir El Ater", "Morsott", "Ouenza", "Negrine"],
		"13 - Tlemcen": ["Tlemcen", "Mansourah", "Chetouane", "Maghnia", "Remchi", "Ghazaouet", "Sebdou", "Nedroma", "Hennaya", "Ouled Mimoun"],
		"14 - Tiaret": ["Tiaret", "Sougueur", "Frenda", "Mahdia", "Rahouia", "Ksar Chellala", "Mechraa Sfa", "Dahmouni"],
		"15 - Tizi Ouzou": ["Tizi Ouzou", "Azazga", "Tigzirt", "Azeffoun", "Larbaâ Nath Irathen", "Draâ Ben Khedda", "Boghhni", "Ain El Hammam", "Ouadhia", "Mekla"],
		"16 - Alger": [
			"Alger Centre", "Sidi M'Hamed", "El Madania", "Hamma Annassers", "Bab El Oued", "Bologhine", "Casbah", "Oued Koriche",
			"Bir Mourad Raïs", "El Biar", "Bouzareah", "Ben Aknoun", "Hydra", "El Mouradia", "Béni Messous", "Birmandreis",
			"Kouba", "Hussein Dey", "El Harrach", "Baraki", "Oued Smar", "Bourouba", "Bachdjerrah", "Gué de Constantine",
			"Bordj El Kiffan", "Bab Ezzouar", "Dar El Beïda", "Mohammadia", "Rouïba", "Reghaïa", "Aïn Taya", "Bordj El Bahri",
			"Chéraga", "Dely Ibrahim", "Staoueli", "Zéralda", "Ain Benian", "Douera", "Baba Hassen", "Draria", "Saoula"
		],
		"17 - Djelfa": ["Djelfa", "Ain Oussera", "Messaad", "Hassi Bahbah", "Dar Chioukh", "Charef", "El Idrissia", "Faid El Botma"],
		"18 - Jijel": ["Jijel", "Taher", "El Milia", "El Ancer", "Chekfa", "Djidjelli", "Sidi Abdelaziz", "Ziama Mansouriah"],
		"19 - Sétif": ["Sétif", "El Eulma", "Ain Oulmene", "Ain Azel", "Bougaa", "Ain Arnat", "Beni Aziz", "Amoucha", "Babor", "Guellal"],
		"20 - Saïda": ["Saïda", "Ain El Hadjar", "Youb", "Sidi Boubekeur", "El Hassasna", "Ouled Brahim"],
		"21 - Skikda": ["Skikda", "El Harrouch", "Collo", "Azzaba", "Ben Azzouz", "Tamalous", "Ain Kechra", "Ramdane Djamel"],
		"22 - Sidi Bel Abbès": ["Sidi Bel Abbès", "Telagh", "Ben Badis", "Sfisef", "Sidi Ali Benyoub", "Merine", "Ras El Ma", "Tessala"],
		"23 - Annaba": ["Annaba", "El Bouni", "El Hadjar", "Berrahal", "Seraïdi", "Ain El Berda", "Chetaïbi"],
		"24 - Guelma": ["Guelma", "Oued Zenati", "Bouchegouf", "Héliopolis", "Ain Makhlouf", "Guelaat Bou Sbaa", "Hammam Debagh"],
		"25 - Constantine": ["Constantine", "El Khroub", "Ain Smara", "Hamma Bouziane", "Didouche Mourad", "Zighoud Youcef", "Ibn Ziad", "Ali Mendjeli"],
		"26 - Médéa": ["Médéa", "Berrouaghia", "Ksar El Boukhari", "Beni Slimane", "Tablat", "Ain Boucif", "Ouzera", "Seghouane"],
		"27 - Mostaganem": ["Mostaganem", "Ain Tedeles", "Hassi Mameche", "Sidi Ali", "Bouguirat", "Achaacha", "Sidi Lakhdar", "Kheir Eddine"],
		"28 - M'Sila": ["M'Sila", "Bou Saâda", "Sidi Aïssa", "Ain El Hadjel", "Magra", "Medejedel", "Ben Srour", "Hammam Dalaa"],
		"29 - Mascara": ["Mascara", "Sig", "Mohammadia", "Tighennif", "Ghriss", "Oued El Abtal", "Aouf", "Bouhanifia"],
		"30 - Ouargla": ["Ouargla", "Hassi Messaoud", "Touggourt", "Rouissat", "N'Goussa", "Sidi Khouiled", "El Hadjira"],
		"31 - Oran": ["Oran", "Es Senia", "Bir El Djir", "Arzew", "Ain El Turk", "Bethioua", "Gdyel", "Boutlelis", "Oued Tlelat", "Mers El Kébir", "El Kerma"],
		"32 - El Bayadh": ["El Bayadh", "Brezina", "Bougtob", "El Abiodh Sidi Cheikh", "Rogassa", "Labiodh"],
		"33 - Illizi": ["Illizi", "Djanet", "In Amenas", "Bordj Omar Driss"],
		"34 - Bordj Bou Arreridj": ["Bordj Bou Arreridj", "Ras El Oued", "Mansoura", "Ain Taghrout", "Bordj Zemoura", "El Achir"],
		"35 - Boumerdès": ["Boumerdès", "Dellys", "Zemmouri", "Thénia", "Isser", "Khemis El Khechna", "Boudouaou", "Baghlia", "Chabet El Ameur", "Naciria"],
		"36 - El Tarf": ["El Tarf", "El Kala", "Ben M'Hidi", "Drean", "Bouhadjar", "Besbes", "Berrihane"],
		"37 - Tindouf": ["Tindouf", "Oum El Assel"],
		"38 - Tissemsilt": ["Tissemsilt", "Khemisti", "Theniet El Had", "Bordj Bounaama", "Lardjem", "Ammari"],
		"39 - El Oued": ["El Oued", "Guemar", "Robbah", "Debila", "Magrane", "Bayadha", "Hassi Khalifa", "Taleb Larbi"],
		"40 - Khenchela": ["Khenchela", "Kais", "Chechar", "Bouhmama", "El Hamma", "Babar", "Ouled Rechache"],
		"41 - Souk Ahras": ["Souk Ahras", "Seddrata", "M'Daourouch", "Taoura", "Merahna", "Heddada", "Ouled Driss"],
		"42 - Tipaza": ["Tipaza", "Cherchell", "Kolea", "Hadout", "Bou Ismail", "Fouka", "Damous", "Gouraya", "Sidi Amar", "Douaouda"],
		"43 - Mila": ["Mila", "Chelghoum Laid", "Tadjenanet", "Ferdjioua", "Grarem Gouga", "Oued Endja", "Rouached"],
		"44 - Ain Defla": ["Ain Defla", "Khemis Miliana", "Miliana", "El Attaf", "Djelida", "Djendel", "Rouina", "El Abadia"],
		"45 - Naâma": ["Naâma", "Mecheria", "Ain Sefra", "Tiout", "Sfissifa", "Moghrar", "Asla"],
		"46 - Ain Témouchent": ["Ain Témouchent", "Beni Saf", "Hammam Bou Hadjar", "El Malah", "Ain El Arbaa", "Oulhassa", "El Amria"],
		"47 - Ghardaïa": ["Ghardaïa", "El Atteuf", "Bounoura", "Dhayet Bendhahoua", "Berriane", "El Guerrara", "Metlili", "Zelfana"],
		"48 - Relizane": ["Relizane", "Oued Rhiou", "Mazouna", "Yellel", "Sidi M'Hamed Ben Ali", "Ammi Moussa", "Zemmoura", "Djidiouia"],
		"49 - Timimoun": ["Timimoun", "Aougrout", "Charouine", "Ksar Kaddour", "Deldoul"],
		"50 - Bordj Badji Mokhtar": ["Bordj Badji Mokhtar", "Timiaouine"],
		"51 - Ouled Djellal": ["Ouled Djellal", "Sidi Khaled", "Ras El Miaad", "Besbes"],
		"52 - Béni Abbès": ["Béni Abbès", "Tabelbala", "Igli", "El Ouata", "Kerzaz", "Tamtert"],
		"53 - In Salah": ["In Salah", "In Ghar", "Foggaret Ezzaouia"],
		"54 - In Guezzam": ["In Guezzam", "Tin Zaouatine"],
		"55 - Touggourt": ["Touggourt", "Megarine", "Taibet", "Temacine", "Nezla", "El Hadjira"],
		"56 - Djanet": ["Djanet", "Bordj El Haouas"],
		"57 - El M'Ghair": ["El M'Ghair", "Djamaa", "Oum Touyour", "Sidi Amrane"],
		"58 - El Meniaa": ["El Meniaa", "Hassi Gara", "Hassi Fehal"],
	},
	"United States": {
		"California": ["Los Angeles", "San Francisco", "San Diego", "San Jose", "Sacramento", "Oakland", "Fresno"],
		"New York": ["New York City", "Buffalo", "Rochester", "Albany", "Syracuse", "Yonkers"],
		"Texas": ["Houston", "Austin", "Dallas", "San Antonio", "Fort Worth", "El Paso", "Arlington"],
		"Florida": ["Miami", "Orlando", "Tampa", "Jacksonville", "Fort Lauderdale", "Tallahassee"],
		"Washington": ["Seattle", "Spokane", "Tacoma", "Vancouver", "Bellevue", "Olympia"],
		"Illinois": ["Chicago", "Springfield", "Naperville", "Rockford", "Peoria"],
		"Massachusetts": ["Boston", "Cambridge", "Worcester", "Springfield", "Lowell"],
	},
	"France": {
		"Île-de-France": ["Paris", "Boulogne-Billancourt", "Saint-Denis", "Argenteuil", "Montreuil", "Nanterre", "Créteil", "Versailles"],
		"Auvergne-Rhône-Alpes": ["Lyon", "Saint-Étienne", "Grenoble", "Villeurbanne", "Clermont-Ferrand", "Annecy"],
		"Provence-Alpes-Côte d'Azur": ["Marseille", "Nice", "Toulon", "Aix-en-Provence", "Avignon", "Cannes"],
		"Occitanie": ["Toulouse", "Montpellier", "Nîmes", "Perpignan", "Béziers"],
		"Nouvelle-Aquitaine": ["Bordeaux", "Limoges", "Poitiers", "Pau", "La Rochelle"],
		"Grand Est": ["Strasbourg", "Reims", "Metz", "Mulhouse", "Nancy"],
		"Hauts-de-France": ["Lille", "Amiens", "Roubaix", "Tourcoing", "Dunkerque"],
	},
	"Canada": {
		"Ontario": ["Toronto", "Ottawa", "Mississauga", "Hamilton", "Brampton", "London", "Markham"],
		"Quebec": ["Montreal", "Quebec City", "Laval", "Gatineau", "Longueuil", "Sherbrooke"],
		"British Columbia": ["Vancouver", "Surrey", "Burnaby", "Richmond", "Victoria", "Kelowna"],
		"Alberta": ["Calgary", "Edmonton", "Red Deer", "Lethbridge", "St. Albert"],
	},
	"United Kingdom": {
		"England": ["London", "Manchester", "Birmingham", "Leeds", "Liverpool", "Bristol", "Newcastle", "Sheffield"],
		"Scotland": ["Edinburgh", "Glasgow", "Aberdeen", "Dundee", "Inverness"],
		"Wales": ["Cardiff", "Swansea", "Newport", "Wrexham"],
		"Northern Ireland": ["Belfast", "Derry", "Lisburn", "Newry"],
	},
	"Germany": {
		"Bavaria": ["Munich", "Nuremberg", "Augsburg", "Regensburg", "Ingolstadt"],
		"Berlin": ["Berlin"],
		"North Rhine-Westphalia": ["Cologne", "Düsseldorf", "Dortmund", "Essen", "Bonn"],
		"Baden-Württemberg": ["Stuttgart", "Karlsruhe", "Mannheim", "Freiburg", "Heidelberg"],
		"Hesse": ["Frankfurt", "Wiesbaden", "Kassel", "Darmstadt"],
		"Hamburg": ["Hamburg"],
	},
	"Morocco": {
		"Casablanca-Settat": ["Casablanca", "Mohammedia", "El Jadida", "Settat", "Berrechid"],
		"Rabat-Salé-Kénitra": ["Rabat", "Salé", "Kénitra", "Temara", "Sidi Slimane"],
		"Marrakech-Safi": ["Marrakech", "Safi", "Essaouira", "El Kelaa des Sraghna"],
		"Tanger-Tétouan-Al Hoceïma": ["Tanger", "Tétouan", "Al Hoceïma", "Larache", "Ksar El Kebir"],
		"Fès-Meknès": ["Fès", "Meknès", "Taza", "Sefrou"],
		"Souss-Massa": ["Agadir", "Inezgane", "Taroudant", "Tiznit"],
	},
	"Tunisia": {
		"Tunis": ["Tunis", "La Marsa", "Carthage", "Sidi Bou Said", "Le Bardo"],
		"Sousse": ["Sousse", "Hammam Sousse", "Kalaa Kebira", "M'saken"],
		"Sfax": ["Sfax", "Sakiet Ezzit", "Sakiet Eddaier", "El Hencha"],
		"Nabeul": ["Nabeul", "Hammamet", "Kelibia", "Dar Chaabane"],
		"Monastir": ["Monastir", "Moknine", "Téboulba", "Ksar Hellal"],
	},
	"Saudi Arabia": {
		"Riyadh Province": ["Riyadh", "Al Kharj", "Diriyah", "Ad Dawadimi"],
		"Makkah Province": ["Jeddah", "Mecca", "Taif", "Rabigh"],
		"Eastern Province": ["Dammam", "Khobar", "Dhahran", "Al Jubail", "Al Ahsa", "Qatif"],
		"Madinah Province": ["Medina", "Yanbu", "Al Ula"],
	},
	"United Arab Emirates": {
		"Dubai": ["Dubai", "Jebel Ali", "Hatta"],
		"Abu Dhabi": ["Abu Dhabi", "Al Ain", "Al Dhafra"],
		"Sharjah": ["Sharjah", "Khor Fakkan", "Kalba"],
		"Ajman": ["Ajman"],
		"Ras Al Khaimah": ["Ras Al Khaimah"],
	},
	"Egypt": {
		"Cairo": ["Cairo", "New Cairo", "Helwan", "Nasr City", "Maadi"],
		"Alexandria": ["Alexandria", "Borg El Arab"],
		"Giza": ["Giza", "6th of October", "Sheikh Zayed"],
	},
	"Spain": {
		"Madrid": ["Madrid", "Alcalá de Henares", "Móstoles", "Fuenlabrada", "Getafe"],
		"Catalonia": ["Barcelona", "L'Hospitalet de Llobregat", "Badalona", "Terrassa", "Sabadell"],
		"Andalusia": ["Seville", "Málaga", "Córdoba", "Granada", "Jerez de la Frontera"],
		"Valencian Community": ["Valencia", "Alicante", "Elche", "Castellón de la Plana"],
	},
	"Italy": {
		"Lombardy": ["Milan", "Brescia", "Monza", "Bergamo", "Como"],
		"Lazio": ["Rome", "Latina", "Guidonia Montecelio", "Fiumicino"],
		"Campania": ["Naples", "Salerno", "Giugliano in Campania", "Caserta"],
		"Piedmont": ["Turin", "Novara", "Alessandria"],
	},
	"Turkey": {
		"Istanbul": ["Istanbul", "Kadikoy", "Besiktas", "Uskudar", "Sisli", "Bakirkoy"],
		"Ankara": ["Ankara", "Cankaya", "Kecioren", "Yenimahalle"],
		"Izmir": ["Izmir", "Karsiyaka", "Bornova", "Konak"],
		"Antalya": ["Antalya", "Alanya", "Manavgat", "Muratpasa"],
	},
};

export const POPULAR_COUNTRIES = Object.keys(LOCATION_DATA);

export function getStatesForCountry(country: string): string[] {
	if (!country) return [];
	const matchedCountry = Object.keys(LOCATION_DATA).find(
		(c) => c.toLowerCase() === country.toLowerCase()
	);
	if (!matchedCountry) return [];
	return Object.keys(LOCATION_DATA[matchedCountry]);
}

export function getCitiesForState(country: string, state: string): string[] {
	if (!country || !state) return [];
	const matchedCountry = Object.keys(LOCATION_DATA).find(
		(c) => c.toLowerCase() === country.toLowerCase()
	);
	if (!matchedCountry) return [];
	const statesObj = LOCATION_DATA[matchedCountry];
	const matchedState = Object.keys(statesObj).find(
		(s) => s.toLowerCase() === state.toLowerCase() || s.includes(state) || state.includes(s)
	);
	if (!matchedState) return [];
	return statesObj[matchedState] || [];
}
