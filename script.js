// Ganti dengan Project URL dan anon public key Anda
const supabaseClient_URL = 'https://jyjunbzusfrmaywmndpa.supabase.co';
const supabaseClient_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5anVuYnp1c2ZybWF5d21uZHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NDMxMTgsImV4cCI6MjA2OTQxOTExOH0.IQ6yyyR2OpvQj1lIL1yFsWfVNhJIm2_EFt5Pnv4Bd38';
// Dapatkan semua tombol dengan class 'tombol-lintasan'
const tombolLintasan = document.querySelectorAll('.tombol-lintasan');
// Inisialisasi klien supabaseClient
const supabaseClient = supabase.createClient(supabaseClient_URL, supabaseClient_ANON_KEY);

let hasStarted = false;
let hasReachedBuoys = false;
let hastakenunderwaterImage = false;

// --- Konstanta dan Perhitungan ---
const totalSideLengthMeters = 25;
const gridIntervalMeters = 5;
const numDivisions = totalSideLengthMeters / gridIntervalMeters;

// Fungsi untuk mengkonversi meter ke perubahan lintang dan bujur
function metersToLatLon(centerLat, meters) {
    const metersPerDegLat = 111320; // rata-rata
    const metersPerDegLon = 111320 * Math.cos(centerLat * Math.PI / 180);

    return {
        dLat: meters / metersPerDegLat,
        dLon: meters / metersPerDegLon
    };
}

// lintasan1 
let curretlintasan = 'lintasan1'; 


// Variabel global untuk grid
let gridLayers1 = L.layerGroup();
let gridLayers2 = L.layerGroup();



const centerLat = -7.769356;
const centerLon = 110.383056;
const map = L.map('map', {
    center: [centerLat, centerLon],
    zoom: 1, 
    scrollWheelZoom: false,
    dragging: false,
    doubleClickZoom: false,
    boxZoom: false,
    touchZoom: false,
    zoomControl: false
});

// Tambahkan peta dasar dari OpenStreetMap
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png', {
    maxZoom: 21.2,
    minZoom: 21.2,
    // attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
}).addTo(map);


let getBounds = [];

// map.setMaxBounds(getBounds);
// map.fitBounds(getBounds); 


// Variabel untuk visualisasi lintasan & kapal
let missionPath = null;
let latestPosition = null; 
let latestData = null; 
let latestCog = null; 
// Variabel untuk interval pembaruan peta
let MAP_UPDATE_INTERVAL = 2500; // Interval pembaruan peta dalam milidetik
let lastMapUpdate = 0; // Waktu terakhir peta diperbarui
let currentPositionMarker = null; // Marker untuk posisi kapal
const trackCoordinates = []; // Array untuk menyimpan koordinat lintasan
// Perubahan lintang dan bujur untuk 12.5 meter
const deltaLat = 0.0001125; 
const deltaLon = 0.000113;
const lintasan1Button = document.getElementById('lintasan1');
const lintasan2Button = document.getElementById('lintasan2');
const refreshButton = document.getElementById('tombol_refresh');

const shipIcon = L.icon({
    // URL gambar ikon kapal
    iconUrl: 'kapalasli.png',
    
    // Ukuran ikon dalam piksel
    iconSize: [10, 20], 
    
    // Titik jangkar ikon yang akan menempel pada koordinat
    iconAnchor: [19, 19], 
    
    // Titik di mana popup akan muncul di atas ikon
    popupAnchor: [0, -19]
});

const redBuoyIcon = L.icon({
    iconUrl: 'merah.png',
    iconSize: [5, 5],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
});

const greenBuoyIcon = L.icon({
    iconUrl: 'hijau.png',
    iconSize: [5, 5],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
});

const startIcon = L.icon({
    iconUrl: 'start.png',
    iconSize: [40, 40],
    iconAnchor: [12, 24],
    popupAnchor: [0, -20]
});

const finishIcon = L.icon({
    iconUrl: 'finish.png',
    iconSize: [25, 25],
    iconAnchor: [12, 24],
    popupAnchor: [0, -20]
    // membuat icon agak tebus pandang
});

const Object_surface = L.icon({
    iconUrl: 'atas.jpeg',
    iconSize: [10, 10],
    iconAnchor: [12, 24],
    popupAnchor: [0, -20]
});
const Object_under = L.icon({
    iconUrl: 'bawah.png',
    iconSize: [10, 10],
    iconAnchor: [12, 24],
    popupAnchor: [0, -20]
});

// 

let waypointLayers = L.layerGroup(); // LayerGroup untuk menampung semua marker waypoint

// --- FUNGSI BARU: Menggambar Waypoint ---
function drawWaypoints(missionType) {

    const waypoints = missionWaypoints[missionType];

    // Gambar marker start
    L.marker(waypoints.start, { icon: startIcon, opacity: 1 })
        .addTo(waypointLayers)
        .bindPopup('Titik Start');

    // Gambar marker finish
    L.marker(waypoints.finish, { icon: finishIcon, opacity: 0.4 })
        .addTo(waypointLayers)
        .bindPopup('Titik Finish');

    // Gambar marker surface image
    L.marker(waypoints.image_surface, { icon: Object_surface, opacity: 0.4 })
        .addTo(waypointLayers)
        .bindPopup('image surface');

    // Gambar marker underwater image
    L.marker(waypoints.image_underwater, { icon: Object_under, opacity: 0.4 })
        .addTo(waypointLayers)
        .bindPopup('image underwater');


    waypointLayers.addTo(map); // Tambahkan layer ke peta
}

// Fungsi untuk menentukan arah (N/S, E/W)
function getCardinalDirection(value, type) {
    if (type === 'lat') {
        return value >= 0 ? 'N' : 'S';
    } else if (type === 'lon') {
        return value >= 0 ? 'E' : 'W';
    }
    return '';
}

// Fungsi menentukan minimal jarak terhadap misi
function isNear(currentPosition, targetPosition, toleranceMeters) {
    // Fungsi ini menghitung jarak antara dua koordinat
    const from = L.latLng(currentPosition[0], currentPosition[1]);
    const to = L.latLng(targetPosition[0], targetPosition[1]);
    return from.distanceTo(to) <= toleranceMeters;
}

// Menentukan misi lintasan 1 atau lintasan 2
const missionWaypoints = {
    'lintasan2': {
        'start': [-7.915141, 112.588725],
        'buoys': [-7.769300, 110.383150],
        'finish': [-7.769250, 110.383080],
        'image_surface': [-7.915095, 112.588896],
        'image_underwater': [-7.915124, 112.588874]
        // ... tambahkan titik misi lain di sini
    },
    'lintasan1': {
        'start': [-7.769000, 110.383500],
        'buoys': [-7.768950, 110.383400],
        'finish': [-7.768850, 110.383450],
        'image_surface': [-7.915095, 112.588896],
        'image_underwater': [-7.915124, 112.588874]
        // ... tambahkan titik misi lain di sini
    }
};

// Fungsi Mengubah Status Misi
function updateMissionStatus(element, status) {
    if (!element) return;
    const parentKotak = element;
    parentKotak.classList.remove('kotak-belum', 'kotak-proses', 'kotak-selesai');
    if (status === 'belum') {
        parentKotak.classList.add('kotak-belum');
    } else if (status === 'proses') {
        parentKotak.classList.add('kotak-proses');
    } else if (status === 'selesai') {
        parentKotak.classList.add('kotak-selesai');
    }
}

// Fungsi untuk memperbarui status misi dari database
// async function updateMissionStatusInSupabase(missionId, status) {
//     // Logika untuk mengubah missionId menjadi nama kolom yang sesuai
//     const columnName = `status_${missionId.replace('mission-', '').replace('-kotak', '')}`;
    
//     try {
//         const updateData = {};
//         updateData[columnName] = status; // Mengirim status sebagai string

//         const { error } = await supabaseClient
//             .from('data_mission')
//             .update(updateData)
//             .eq('id', 1);
        
//         if (error) throw error;
//         console.log(`Status misi '${columnName}' berhasil diperbarui menjadi ${status}.`);
//     } catch (error) {
//         console.error('Gagal memperbarui status misi:', error);
//     }
// }

async function updateMissionStatusInSupabase(missionId, status) {
    // Peta missionId (dari HTML) ke kolom DB
    const columnMap = {
        'mission-persiapan': 'mission_persiapan',
        'mission-start': 'mission_start',
        'mission-buoys': 'mission_buoys',
        'mission-imagesurface': 'image_atas',
        'mission-imageunderwater': 'image_bawah',
        'mission-finish': 'mission_finish'
    };

    const columnName = columnMap[missionId];
    if (!columnName) {
        console.error(`Kolom tidak ditemukan untuk missionId: ${missionId}`);
        return;
    }

    try {
        const updateData = {};
        updateData[columnName] = status;

        const { error } = await supabaseClient
            .from('data_mission')
            .update(updateData)
            .eq('id', 1);

        if (error) throw error;
        console.log(`Status misi '${columnName}' berhasil diperbarui menjadi ${status}.`);
    } catch (error) {
        console.error('Gagal memperbarui status misi:', error);
    }
}


// Fungsi untuk format A: Degree, Decimal (DD,DDDD)
function formatA(lat, lon) {
    const latDirection = getCardinalDirection(lat, 'lat');
    const lonDirection = getCardinalDirection(lon, 'lon');
    const absLat = Math.abs(lat).toFixed(6);
    const absLon = Math.abs(lon).toFixed(6);
    return `${latDirection} ${absLat} ${lonDirection} ${absLon}`;
}

// Fungsi untuk format B: Degree, Minute (DD MM,MMMM)
function formatB(lat, lon) {
    // Konversi Latitude
    const latDirection = getCardinalDirection(lat, 'lat');
    const absLat = Math.abs(lat);
    const latDegrees = Math.floor(absLat);
    const latMinutes = (absLat - latDegrees) * 60;

    // Konversi Longitude
    const lonDirection = getCardinalDirection(lon, 'lon');
    const absLon = Math.abs(lon);
    const lonDegrees = Math.floor(absLon);
    const lonMinutes = (absLon - lonDegrees) * 60;

    return `${latDirection} ${latDegrees}° ${latMinutes.toFixed(4)}' ${lonDirection} ${lonDegrees}° ${lonMinutes.toFixed(4)}'`;
}


// --- Fungsi untuk memperbarui UI ---
// Fungsi untuk memperbarui UI data navigasi
function updateNavUI(data) {
    // Perbaikan: Pastikan `data` ada sebelum mengakses propertinya
    if (!data) {
        // Jika data kosong, atur semua ke 'N/A'
        document.getElementById('timestamp').innerText = 'N/A';
        document.getElementById('sog_kmh').innerText = 'N/A';
        // document.getElementById('sog_knots').innerText = 'N/A';
        // document.getElementById('cog').innerText = 'N/A';
        document.getElementById('latitude').innerText = 'N/A';
        document.getElementById('longitude').innerText = 'N/A';
        return;
    }

   
    const sog_kmh = msToKmh(data.sog_ms);
    const formattedA = formatA(data.latitude, data.longitude);

    document.getElementById('timestamp').innerText = new Date(data.timestamp).toLocaleString();
    document.getElementById('sog_kmh').innerText = sog_kmh.toFixed(2);
    // document.getElementById('sog_knots').innerText = sog_knots.toFixed(2);
    // document.getElementById('cog').innerText = data.cog.toFixed(2);
    // document.getElementById('latitude').innerText = data.latitude.toFixed(6);
    // document.getElementById('longitude').innerText = data.longitude.toFixed(6);
    document.getElementById('formatted_a').innerText = formattedA;

}


function updateCogUI(data) {
    document.getElementById('cog').innerText = data.cog ? data.cog.toFixed(2) : 'N/A';
}


// Mengambar line dari koordinat lintasan
function updateMapVisuals() {

    if (currentPositionMarker) {
        currentPositionMarker.setLatLng(latestPosition); // Menggunakan argumen 'position'
    } else {
        currentPositionMarker = L.marker(latestPosition, { icon: shipIcon,}).addTo(map);
    }

    trackCoordinates.push(latestPosition);
    // Periksa apakah trackCoordinates memiliki setidaknya dua koordinat
    if (trackCoordinates.length < 2) {
        console.warn('Tidak cukup data untuk menggambar lintasan.');
        return;}

    if (missionPath) {
        missionPath.setLatLngs(trackCoordinates);
    } else {
        missionPath = L.polyline(trackCoordinates, { color: 'blue', weight: 0.5, dashArray: '5, 5' }).addTo(map);
    }
}

// Menggambar grid pada peta
function drawGrid(missionType) {
    let layersToDraw, centerPoint, latLabels, lonLabels;

    // Tentukan parameter berdasarkan jenis misi
    if (missionType === 'lintasan1') {
        layersToDraw = gridLayers1;
        centerPoint = [-7.769356, 110.383056];
        latLabels = ['1', '2', '3', '4', '5'];
        lonLabels = ['A', 'B', 'C', 'D', 'E'];
        const { dLat, dLon } = metersToLatLon(centerPoint[0], 5);
        deltaLat_5m = dLat;
        deltaLon_5m = dLon;
    } else { // Lintasan 2
        layersToDraw = gridLayers2;
        centerPoint = [-7.915044, 112.588824];
        latLabels = ['A', 'B', 'C', 'D', 'E'];
        lonLabels = ['1', '2', '3', '4', '5'];
        const { dLat, dLon } = metersToLatLon(centerPoint[0], 5);
        deltaLat_5m = dLat;     
        deltaLon_5m = dLon;
    }
    
    const totalDeltaLat = deltaLat_5m * numDivisions;
    const totalDeltaLon = deltaLon_5m * numDivisions;

    const newBounds = L.latLngBounds(
        [centerPoint[0] - totalDeltaLat / 2, centerPoint[1] - totalDeltaLon / 2],
        [centerPoint[0] + totalDeltaLat / 2, centerPoint[1] + totalDeltaLon / 2]
    );

      

    // Gambar garis dan label
    for (let i = 0; i <= numDivisions; i++) {
        const lat = newBounds.getSouth() + (i * (totalDeltaLat / numDivisions));
        L.polyline([[lat, newBounds.getWest()], [lat, newBounds.getEast()]], { color: '#888', weight: 0.5 }).addTo(layersToDraw);
        
        const lon = newBounds.getWest() + (i * (totalDeltaLon / numDivisions));
        L.polyline([[newBounds.getSouth(), lon], [newBounds.getNorth(), lon]], { color: '#888', weight: 0.5 }).addTo(layersToDraw);
    }
    
    // Tambahkan label
    for (let i = 0; i < numDivisions; i++) {
        const lat = newBounds.getSouth() + ((i+1 ) * (totalDeltaLat / numDivisions));
        const lon = newBounds.getWest() + ((i+1) * (totalDeltaLon / numDivisions));

        L.marker([lat, newBounds.getWest()], {
            icon: L.divIcon({ className: 'grid-label-1', html: latLabels[i], iconAnchor: [10, 10] })
        }).addTo(layersToDraw);

        L.marker([newBounds.getSouth(), lon], {
            icon: L.divIcon({ className: 'grid-label-2', html: lonLabels[i], iconAnchor: [10, 10] })
        }).addTo(layersToDraw);
    }
}


// Fungsi untuk memperbarui UI gambar misi
function updateMissionImagesUI(images) {
    const kameraDepanContainer = document.getElementById('kamera-depan-container');
    const kameraBelakangContainer = document.getElementById('kamera-belakang-container');

    // Kosongkan container
    kameraDepanContainer.innerHTML = '';
    kameraBelakangContainer.innerHTML = '';

    if (!images || images.length === 0) {
        kameraDepanContainer.innerHTML = '<p>Belum ada foto.</p>';
        kameraBelakangContainer.innerHTML = '<p>Belum ada foto.</p>';
        return;
    }
    
    // Proses setiap gambar yang diambil dari database
    images.forEach(imgData => {
        const imgElement = document.createElement('img');
        imgElement.src = imgData.image_url;
        imgElement.alt = `Foto dari ${imgData.image_slot_name}`;

        if (imgData.image_slot_name === 'kamera_atas') {
            kameraDepanContainer.appendChild(imgElement);


        } else if (imgData.image_slot_name === 'kamera_bawah') {
            kameraBelakangContainer.appendChild(imgElement);
            hastakenunderwaterImage = true; // Tandai bahwa gambar bawah telah diambil
      
        }
    });
}

// Fungsi untuk mengkonversi meter per detik ke kilometer per jam
function msToKmh(sog_ms) {
    if (typeof sog_ms !== 'number' || isNaN(sog_ms)) {
        return 0;
    }
    return sog_ms * 3.6;
}

// Fungsi untuk mengkonversi meter per detik ke knot
function msToKnots(sog_ms) {
    if (typeof sog_ms !== 'number' || isNaN(sog_ms)) {
        return 0;
    }
    return sog_ms * 1.94384;
}

// Memperbarui Pilihan Lintasan

async function updateMapViewInSupabase(viewType) {
    try {
        const { error } = await supabaseClient
            .from('map_state')
            .update({ view_type: viewType })
            .eq('id', 1); // Asumsi ada satu baris data dengan id = 1
        
        if (error) throw error;
        console.log(`Status peta diperbarui menjadi: ${viewType}`);
    } catch (error) {
        console.error('Gagal memperbarui status peta:', error);
    }
}

// menghapus lintasan misi
function clearMap() {
    if (missionPath) {
        map.removeLayer(missionPath);
        missionPath = null;
    }
    if (currentPositionMarker) {
        map.removeLayer(currentPositionMarker);
        currentPositionMarker = null;
    }
    trackCoordinates.length = 0;
    latestPosition = null;
    latestData = null;
    console.log("Peta telah di-refresh dan dibersihkan.");
}

// Fungsi untuk mengirim sinyal refresh ke Supabase
async function triggerRefresh() {
    try {
        const { error } = await supabaseClient
            .from('map_state')
            .update({ is_refreshed: true})
            .eq('id', 1);

        if (error) throw error;
        console.log('Sinyal refresh terkirim.');
    } catch (error) {
        console.error('Gagal mengirim sinyal refresh:', error);
    }
}

async function resetMissionStatusInSupabase() {
    try {
        const resetData = {
            mission_persiapan: 'belum',
            mission_start: 'belum',
            mission_buoys: 'belum',
            image_atas: 'belum',
            image_bawah: 'belum',
            mission_finish: 'belum'
        };
        const { error } = await supabaseClient
            .from('data_mission')
            //bagaimana cara upload
            .update(resetData)
            .eq('id', 1);

        if (error) throw error;
        console.log('Semua status misi berhasil direset di database.');
    } catch (error) {
        console.error('Gagal mereset status misi:', error);
    }
}

function updateMissionStatusFromDB(data) {
    if (!data) return;

    // Perbarui setiap status misi berdasarkan nama kolom yang benar
    updateMissionStatus(document.getElementById('mission-persiapan'), data.mission_persiapan);
    updateMissionStatus(document.getElementById('mission-start'), data.mission_start);
    updateMissionStatus(document.getElementById('mission-buoys'), data.mission_buoys);
    updateMissionStatus(document.getElementById('mission-imagesurface'), data.image_atas);
    updateMissionStatus(document.getElementById('mission-imageunderwater'), data.image_bawah);
    updateMissionStatus(document.getElementById('mission-finish'), data.mission_finish);
}

// --- Fungsi fetchBuoyData() yang diperbarui ---
async function fetchBuoyData() {
    try {
        const { data: buoys, error } = await supabaseClient
            .from('buoys')
            .select('*');

        if (error) throw error;

        buoys.forEach(buoy => {
            const icon = buoy.color === 'red' ? redBuoyIcon : greenBuoyIcon;
            L.marker([buoy.latitude, buoy.longitude], { icon: icon })
                .addTo(map)
                .bindPopup(`Pelampung ${buoy.color}`);
        });

    } catch (error) {
        console.error('Gagal mengambil data pelampung:', error);
    }
}

// --- Fungsi untuk mengambil data awal (initial fetch) ---
async function fetchInitialData() {
    const errorMessageElement = document.getElementById('error-message');
    try {
        // Ambil data navigasi paling baru
        errorMessageElement.innerText = '';
        errorMessageElement.classList.remove('error-message');
        
        const { data: navData, error: navError } = await supabaseClient
            .from('nav_data') // Perbaikan: Gunakan 'nav_data' yang konsisten
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(1);

        if (navError) throw navError;
        
        if (navData.length > 0) {
        
            latestPosition = [navData[0].latitude, navData[0].longitude];
            latestData = navData[0];
            updateNavUI(latestData);
            updateMapVisuals(); // Perbarui visualisasi peta dengan data navigasi terbaru

             } 
        else {
            // Tangani kasus di mana tidak ada data navigasi
            updateNavUI(null);
        }

        const {data: cogData, error: cogError} = await supabaseClient
            .from('cog_data') // Perbaikan: Gunakan 'cog' yang
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(1);

        if (cogError) throw cogError;

        if (cogData.length > 0) {
            
            updateCogUI(cogData[0]);
            // Perbarui visualisasi peta dengan data navigasi terbaru
            
            // currentPositionMarker = L.marker([navData[0].latitude, navData[0].longitude], { icon: shipIcon, rotationAngle: cogData[0].cog }).addTo(map);
        } else {
            // Tangani kasus di mana tidak ada data COG     
            updateCogUI(null);
        }
        
        // Ambil semua data gambar
        const { data: images, error: imagesError } = await supabaseClient
            .from('image_mission') // Perbaikan: Gunakan 'image_mission' yang konsisten
            .select('*');
        
        if (imagesError) throw imagesError;
        
        updateMissionImagesUI(images); // Perbaikan: Kirim data langsung ke fungsi UI

        errorMessageElement.innerText = '';

    } catch (error) {
        errorMessageElement.innerText = `Gagal mengambil data awal: ${error.message}. Periksa konsol.`;
        errorMessageElement.classList.add('error-message');
        console.error('Error fetching initial data:', error);
    }
}

// --- Realtime Subscriptions untuk update otomatis ---

// Menggunakan Realtime untuk data navigasi
supabaseClient
  .channel('nav_data_changes')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'nav_data' }, async payload => { // Perbaikan: Gunakan 'nav_data'
    console.log('Realtime Nav Data Update:', payload.new);
    updateNavUI(payload.new);
    latestData = payload.new;
    latestPosition = [payload.new.latitude, payload.new.longitude];
    // Perbarui posisi kapal di peta
    updateMapVisuals();
    const tolerance = 5; // Toleransi dalam meter
    const waypoints = missionWaypoints[curretlintasan]; // Ambil titik awal dari lintasan yang aktif

    if (isNear(latestPosition, waypoints.start, tolerance)) {
        await updateMissionStatusInSupabase('mission-persiapan', 'selesai');
        await updateMissionStatusInSupabase('mission-start', 'proses');
    }
    if (isNear(latestPosition, waypoints.start, tolerance)) {
        await updateMissionStatusInSupabase('mission-start', 'selesai');
        await updateMissionStatusInSupabase('mission-buoys', 'proses');
    }
    if (isNear(latestPosition, waypoints.buoys, tolerance)) {
        await updateMissionStatusInSupabase('mission-buoys', 'selesai');
        await updateMissionStatusInSupabase('mission-imagesurface', 'proses');
        await updateMissionStatusInSupabase('mission-imageunderwater', 'proses');
    }

    if (isNear(latestPosition, waypoints.finish, tolerance) && hastakenunderwaterImage) {
        await updateMissionStatusInSupabase('mission-finish', 'selesai');
    }

    
  })
  .subscribe();

// Menggunakan Realtime untuk data COG
supabaseClient
    .channel('cog_data_changes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cog_data' }, payload => { // Perbaikan: Gunakan 'cog_data'
        console.log('Realtime COG Data Update:', payload.new);
    updateCogUI(payload.new);
    if (currentPositionMarker) {
        currentPositionMarker.setRotationAngle(payload.new.cog);
    }
    
    })
    .subscribe();  

// Menggunakan Realtime untuk gambar misi
supabaseClient
  .channel('mission_images_changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'image_mission' }, async payload => {
    console.log('Realtime Mission Images Update:', payload);
    
    // Perbaikan: Panggil ulang fungsi yang mengambil semua gambar terbaru
    // untuk memastikan tampilan selalu sinkron.
    const { data: images, error } = await supabaseClient
      .from('image_mission') 
      .select('*');

    if (error) {
        console.error('Error fetching mission images after realtime update:', error);
        return;
    }
    updateMissionImagesUI(images);
    update
  })
  .subscribe();

// Realtime untuk sinkronisasi peta
supabaseClient
  .channel('map_state_changes')
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'map_state' }, payload => {
    const newViewType = payload.new.view_type;
    const isRefreshed = payload.new.is_refreshed;
    console.log(`Perubahan status peta diterima: ${newViewType}`);
    console.log(`Is peta telah di-refresh? ${isRefreshed}`);

    if (newViewType === 'lintasan1') {
        x=-7.769356;
        y=110.383056;
        map.setView([x, y], 23);
        getBounds = [
    [x-deltaLat,y-deltaLon], // Sudut Kiri Bawah (min lat, min lon)
    [x+deltaLat,y+deltaLon]];  // Sudut Kanan Atas (max lat, max lon)
        map.setMaxBounds(getBounds);
        map.fitBounds(getBounds);
        curretlintasan = 'lintasan1';
         // Update lintasan saat tombol diklik

    } else if (newViewType === 'lintasan2') {
            x = -7.915044;
            y = 112.588824;
        map.setView([x, y], 23);
        getBounds = [
    [x-deltaLat,y-deltaLon], // Sudut Kiri Bawah (min lat, min lon)
    [x+deltaLat,y+deltaLon]];  // Sudut Kanan Atas (max lat, max lon)
        map.setMaxBounds(getBounds);            
        map.fitBounds(getBounds);
        curretlintasan = 'lintasan2'; // Update lintasan saat tombol diklik
        

}
    
    if (newViewType === 'lintasan1' && lintasan1Button) {
        lintasan1Button.classList.add('aktif');
        lintasan2Button.classList.remove('aktif');
    } else if (newViewType === 'lintasan2' && lintasan2Button) {
        lintasan2Button.classList.add('aktif');
        lintasan1Button.classList.remove('aktif');
    }

    if (isRefreshed) {
        clearMap();
        resetMissionStatusInSupabase(); // Reset status misi di database
        // **Penting**: Kirim sinyal update kembali untuk mereset is_refreshed menjadi false
        supabaseClient
            .from('map_state')
            .update({ is_refreshed: false })
            .eq('id', 1)
            .then(({ error }) => {
                if (error) console.error('Gagal mereset is_refreshed:', error);
            });
        hastakenunderwaterImage = false; 
    }
        
  })
  .subscribe();

// Realtime untuk pembaruan status misi  
supabaseClient
    .channel('mission_log_changes')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'data_mission' }, payload => {
        // Panggil fungsi untuk memperbarui status misi di UI
        updateMissionStatusFromDB(payload.new);
    
    })
    .subscribe();



// Tambahkan event listener saat dokumen selesai dimuat
document.addEventListener('DOMContentLoaded', () => {

    drawWaypoints('lintasan1');
    drawWaypoints('lintasan2');
    x=-7.769356;
    y=110.383056;
    MaxgetBounds = [
    [x-(1+deltaLat),y-(1+deltaLon)], // Sudut Kiri Bawah (min lat, min lon)
    [x+2*deltaLat,y+1+deltaLon]];
        window.boundsLayer = L.rectangle(MaxgetBounds, {
        color: "blue",       // warna garis
           // tebal garis
        fillColor: "#ADD8E6",   // warna isi biru muda
        fillOpacity: 1  
    }).addTo(map);

    x = -7.915044;
    y = 112.588824;
    
    MaxgetBounds = [
    [x-(1+deltaLat),y-(1+deltaLon)], // Sudut Kiri Bawah (min lat, min lon)
    [x+2*deltaLat,y+1+deltaLon]];
        window.boundsLayer = L.rectangle(MaxgetBounds, {
        color: "blue",       // warna garis
           // tebal garis
        fillColor: "#ADD8E6",   // warna isi biru muda
        fillOpacity: 1  
    }).addTo(map);
    fetchInitialData();

    // Gambar grid untuk lintasan 1 dan 2
    drawGrid('lintasan1');
    drawGrid('lintasan2'); 
    gridLayers1.addTo(map);
    gridLayers2.addTo(map);

    fetchBuoyData();
    
    if (lintasan1Button) {
        lintasan1Button.addEventListener('click', () => {
            updateMapViewInSupabase('lintasan1');
            map.fitBounds(gridLayers1.getBounds());

            // Hapus class 'aktif' dan tambahkan pada tombol yang baru diklik
        });
    }

    if (lintasan2Button) {
        lintasan2Button.addEventListener('click', () => {
            updateMapViewInSupabase('lintasan2');
            map.fitBounds(gridLayers2.getBounds());

        });
    }

    // Hubungkan tombol refresh dengan fungsi clearMap()
    if (refreshButton) {
        refreshButton.addEventListener('click', () => {
            triggerRefresh();
        });
    }
});