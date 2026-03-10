import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { incidentService } from '@services/incidentService.js'

const sampleIncidents = [
  // ── Active incidents with specific dates & times ──
  {
    id: 1,
    title: 'Building Fire Reported',
    description: 'Major fire broke out in a 4-story residential building. Multiple families trapped on upper floors.',
    incident_type: 'FIRE',
    severity: 'CRITICAL',
    status: 'DISPATCHED',
    location: { coordinates: [72.8777, 19.0760] },
    location_name: 'Andheri West, Mumbai',
    address: 'Andheri West, Mumbai',
    reporter: {
      name: 'Rajesh Kumar', phone: '+91-9876543210', email: 'rajesh.kumar@gmail.com',
      role: 'CIVILIAN', avatar: 'https://i.pravatar.cc/150?img=1',
      address: 'Flat 401, Skyview Apartments, Andheri West, Mumbai - 400058',
      location: { lat: 19.1364, lng: 72.8296 },
      family_members: [
        { name: 'Sunita Kumar', relation: 'Wife', phone: '+91-9876543211' },
        { name: 'Aryan Kumar', relation: 'Son', phone: '+91-9876543212' },
      ],
    },
    created_at: '2026-03-06T22:45:00+05:30',
  },
  {
    id: 2,
    title: 'Road Accident - Highway',
    description: 'Multi-vehicle collision on NH-44. At least 3 vehicles involved, injuries reported.',
    incident_type: 'ROAD_ACCIDENT',
    severity: 'HIGH',
    status: 'EN_ROUTE',
    location: { coordinates: [77.5946, 12.9716] },
    location_name: 'MG Road, Bengaluru',
    address: 'MG Road, Bengaluru',
    reporter: {
      name: 'Priya Sharma', phone: '+91-9123456780', email: 'priya.sharma@outlook.com',
      role: 'CIVILIAN', avatar: 'https://i.pravatar.cc/150?img=5',
      address: '23, 2nd Cross, Indiranagar, Bengaluru - 560038',
      location: { lat: 12.9784, lng: 77.6408 },
      family_members: [
        { name: 'Rohit Sharma', relation: 'Husband', phone: '+91-9123456781' },
      ],
    },
    created_at: '2026-03-06T18:30:00+05:30',
  },
  {
    id: 3,
    title: 'Medical Emergency - SOS',
    description: 'Elderly person collapsed in public area. Cardiac arrest suspected. Ambulance requested.',
    incident_type: 'MEDICAL',
    severity: 'CRITICAL',
    status: 'ON_SCENE',
    location: { coordinates: [77.2090, 28.6139] },
    location_name: 'Connaught Place, New Delhi',
    address: 'Connaught Place, New Delhi',
    reporter: {
      name: 'Amit Patel', phone: '+91-9988776655', email: 'amit.patel@helpnet.org',
      role: 'VOLUNTEER', avatar: 'https://i.pravatar.cc/150?img=8',
      address: 'B-12, Rajouri Garden, New Delhi - 110027',
      location: { lat: 28.6448, lng: 77.1219 },
      family_members: [
        { name: 'Neha Patel', relation: 'Wife', phone: '+91-9988776656' },
        { name: 'Riya Patel', relation: 'Daughter', phone: '+91-9988776657' },
        { name: 'Mohan Patel', relation: 'Father', phone: '+91-9988776658' },
      ],
    },
    created_at: '2026-03-06T14:10:00+05:30',
  },
  {
    id: 4,
    title: 'Flood Warning Alert',
    description: 'Water level rising in low-lying areas. Evacuation advisory issued for nearby residents.',
    incident_type: 'FLOOD',
    severity: 'MEDIUM',
    status: 'REPORTED',
    location: { coordinates: [80.2707, 13.0827] },
    location_name: 'T. Nagar, Chennai',
    address: 'T. Nagar, Chennai',
    reporter: {
      name: 'Deepa Nair', phone: '+91-8899776655', email: 'deepa.nair@yahoo.com',
      role: 'CIVILIAN', avatar: 'https://i.pravatar.cc/150?img=9',
      address: '15, South Usman Road, T. Nagar, Chennai - 600017',
      location: { lat: 13.0418, lng: 80.2341 },
      family_members: [],
    },
    created_at: '2026-03-06T09:00:00+05:30',
  },
  {
    id: 5,
    title: 'Gas Leak Detected',
    description: 'Industrial gas leak near factory area. Residents advised to stay indoors.',
    incident_type: 'CHEMICAL_SPILL',
    severity: 'HIGH',
    status: 'DISPATCHED',
    location: { coordinates: [78.4867, 17.3850] },
    location_name: 'HITEC City, Hyderabad',
    address: 'HITEC City, Hyderabad',
    reporter: {
      name: 'Suresh Reddy', phone: '+91-7766554433', email: 'suresh.reddy@fire.gov.in',
      role: 'RESPONDER', avatar: 'https://i.pravatar.cc/150?img=11',
      address: 'Fire Station No. 5, Madhapur, Hyderabad - 500081',
      location: { lat: 17.4399, lng: 78.3489 },
      family_members: [
        { name: 'Lakshmi Reddy', relation: 'Wife', phone: '+91-7766554434' },
      ],
    },
    created_at: '2026-03-05T21:15:00+05:30',
  },
  {
    id: 6,
    title: 'Building Collapse - Rescue Needed',
    description: 'Partial building collapse after heavy rainfall. Workers may be trapped under debris.',
    incident_type: 'NATURAL_DISASTER',
    severity: 'CRITICAL',
    status: 'EN_ROUTE',
    location: { coordinates: [88.3639, 22.5726] },
    location_name: 'Salt Lake, Kolkata',
    address: 'Salt Lake, Kolkata',
    reporter: {
      name: 'Anita Das', phone: '+91-9345678901', email: 'anita.das@gmail.com',
      role: 'CIVILIAN', avatar: 'https://i.pravatar.cc/150?img=16',
      address: 'CG-45, Sector 2, Salt Lake City, Kolkata - 700091',
      location: { lat: 22.5804, lng: 88.4139 },
      family_members: [
        { name: 'Subhash Das', relation: 'Husband', phone: '+91-9345678902' },
        { name: 'Ria Das', relation: 'Daughter', phone: '+91-9345678903' },
      ],
    },
    created_at: '2026-03-05T16:45:00+05:30',
  },
  {
    id: 7,
    title: 'Road Accident - School Zone',
    description: 'Vehicle hit a pedestrian near school crossing. Minor injuries, traffic blocked.',
    incident_type: 'ROAD_ACCIDENT',
    severity: 'MEDIUM',
    status: 'ON_SCENE',
    location: { coordinates: [75.8577, 26.9124] },
    location_name: 'MI Road, Jaipur',
    address: 'MI Road, Jaipur',
    reporter: {
      name: 'Vikram Singh', phone: '+91-8234567890', email: 'vikram.singh@volunteer.in',
      role: 'VOLUNTEER', avatar: 'https://i.pravatar.cc/150?img=12',
      address: '78, Tonk Road, Jaipur - 302018',
      location: { lat: 26.8857, lng: 75.7849 },
      family_members: [],
    },
    created_at: '2026-03-05T08:20:00+05:30',
  },
  {
    id: 8,
    title: 'Medical Emergency - Poisoning',
    description: 'Food poisoning outbreak at a local restaurant. Multiple patients rushed to hospital.',
    incident_type: 'MEDICAL',
    severity: 'HIGH',
    status: 'REPORTED',
    location: { coordinates: [73.8567, 18.5204] },
    location_name: 'FC Road, Pune',
    address: 'FC Road, Pune',
    reporter: {
      name: 'Meera Joshi', phone: '+91-9567890123', email: 'meera.joshi@gmail.com',
      role: 'CIVILIAN', avatar: 'https://i.pravatar.cc/150?img=20',
      address: '33, Model Colony, FC Road, Pune - 411016',
      location: { lat: 18.5308, lng: 73.8475 },
      family_members: [
        { name: 'Dr. Anil Joshi', relation: 'Husband', phone: '+91-9567890124' },
      ],
    },
    created_at: '2026-03-04T19:50:00+05:30',
  },
  {
    id: 9,
    title: 'Fire at Warehouse',
    description: 'Large fire at chemical storage warehouse. Hazmat team requested. Area being evacuated.',
    incident_type: 'FIRE',
    severity: 'CRITICAL',
    status: 'DISPATCHED',
    location: { coordinates: [72.8311, 21.1702] },
    location_name: 'Industrial Area, Surat',
    address: 'Industrial Area, Surat',
    reporter: {
      name: 'Kiran Desai', phone: '+91-7890123456', email: 'kiran.desai@ndfr.gov.in',
      role: 'RESPONDER', avatar: 'https://i.pravatar.cc/150?img=14',
      address: 'NDRF Camp, Ring Road, Surat - 395002',
      location: { lat: 21.1959, lng: 72.8302 },
      family_members: [
        { name: 'Pallavi Desai', relation: 'Wife', phone: '+91-7890123457' },
        { name: 'Harsh Desai', relation: 'Son', phone: '+91-7890123458' },
      ],
    },
    created_at: '2026-03-04T11:30:00+05:30',
  },
  {
    id: 10,
    title: 'Flood Rescue Operation',
    description: 'Stranded families in waterlogged colony. Boats deployed for evacuation assistance.',
    incident_type: 'FLOOD',
    severity: 'HIGH',
    status: 'ON_SCENE',
    location: { coordinates: [85.1376, 25.6093] },
    location_name: 'Kankarbagh, Patna',
    address: 'Kankarbagh, Patna',
    reporter: {
      name: 'Ravi Prasad', phone: '+91-6789012345', email: 'ravi.prasad@gmail.com',
      role: 'CIVILIAN', avatar: 'https://i.pravatar.cc/150?img=15',
      address: 'D-22, Kankarbagh Colony, Patna - 800020',
      location: { lat: 25.5941, lng: 85.1376 },
      family_members: [
        { name: 'Savita Prasad', relation: 'Wife', phone: '+91-6789012346' },
        { name: 'Rahul Prasad', relation: 'Son', phone: '+91-6789012347' },
        { name: 'Pooja Prasad', relation: 'Daughter', phone: '+91-6789012348' },
      ],
    },
    created_at: '2026-03-03T06:00:00+05:30',
  },
  {
    id: 11,
    title: 'Landslide on Hill Road',
    description: 'Heavy rains triggered a landslide blocking the main highway. 5 vehicles stuck, rescue team en route.',
    incident_type: 'LANDSLIDE',
    severity: 'HIGH',
    status: 'EN_ROUTE',
    location: { coordinates: [77.1734, 31.1048] },
    location_name: 'Mall Road, Shimla',
    address: 'Mall Road, Shimla',
    reporter: {
      name: 'Sanjay Thakur', phone: '+91-9012345678', email: 'sanjay.thakur@hp.gov.in',
      role: 'CIVILIAN', avatar: 'https://i.pravatar.cc/150?img=33',
      address: 'Hotel Willow Banks, Mall Road, Shimla - 171001',
      location: { lat: 31.1048, lng: 77.1734 },
      family_members: [],
    },
    created_at: '2026-03-02T15:30:00+05:30',
  },
  {
    id: 12,
    title: 'Industrial Explosion',
    description: 'Explosion at a chemical plant. Thick smoke in area, fire brigade on scene. 2 workers injured.',
    incident_type: 'INDUSTRIAL_ACCIDENT',
    severity: 'CRITICAL',
    status: 'ON_SCENE',
    location: { coordinates: [73.1812, 22.3072] },
    location_name: 'GIDC, Vadodara',
    address: 'GIDC, Vadodara',
    reporter: {
      name: 'Nilesh Shah', phone: '+91-8901234567', email: 'nilesh.shah@fire.gj.gov.in',
      role: 'RESPONDER', avatar: 'https://i.pravatar.cc/150?img=52',
      address: 'Fire Station, GIDC Makarpura, Vadodara - 390010',
      location: { lat: 22.2712, lng: 73.2002 },
      family_members: [
        { name: 'Jyoti Shah', relation: 'Wife', phone: '+91-8901234568' },
      ],
    },
    created_at: '2026-03-01T04:15:00+05:30',
  },

  // ── Resolved incidents ──
  {
    id: 13,
    title: 'Chemical Spill Contained',
    description: 'Minor chemical spill at factory cleaned up. No injuries reported. Area cleared by hazmat team.',
    incident_type: 'CHEMICAL_SPILL',
    severity: 'MEDIUM',
    status: 'RESOLVED',
    location: { coordinates: [73.0169, 19.0178] },
    location_name: 'Navi Mumbai Industrial Zone',
    address: 'Navi Mumbai Industrial Zone',
    reporter: {
      name: 'Pooja Mehta', phone: '+91-7654321098', email: 'pooja.mehta@gmail.com',
      role: 'CIVILIAN', avatar: 'https://i.pravatar.cc/150?img=25',
      address: 'Sector 15, CBD Belapur, Navi Mumbai - 400614',
      location: { lat: 19.0178, lng: 73.0350 },
      family_members: [],
    },
    created_at: '2026-03-04T13:00:00+05:30',
  },
  {
    id: 14,
    title: 'Earthquake Tremor - Minor',
    description: 'Minor tremor of 3.2 magnitude felt. No structural damage. Precautionary checks completed.',
    incident_type: 'EARTHQUAKE',
    severity: 'LOW',
    status: 'RESOLVED',
    location: { coordinates: [77.5946, 12.9716] },
    location_name: 'Whitefield, Bengaluru',
    address: 'Whitefield, Bengaluru',
    reporter: {
      name: 'Arjun Rao', phone: '+91-6543210987', email: 'arjun.rao@infosys.com',
      role: 'CIVILIAN', avatar: 'https://i.pravatar.cc/150?img=53',
      address: 'Palm Meadows, Whitefield, Bengaluru - 560066',
      location: { lat: 12.9698, lng: 77.7500 },
      family_members: [
        { name: 'Divya Rao', relation: 'Wife', phone: '+91-6543210988' },
      ],
    },
    created_at: '2026-03-01T10:45:00+05:30',
  },
  {
    id: 15,
    title: 'Train Derailment - Rescue Complete',
    description: 'Local train derailed near station. All passengers evacuated safely. Track repair underway.',
    incident_type: 'ACCIDENT',
    severity: 'HIGH',
    status: 'RESOLVED',
    location: { coordinates: [72.8362, 18.9647] },
    location_name: 'Dadar Station, Mumbai',
    address: 'Dadar Station, Mumbai',
    reporter: {
      name: 'Sunil Verma', phone: '+91-5432109876', email: 'sunil.verma@irctc.co.in',
      role: 'VOLUNTEER', avatar: 'https://i.pravatar.cc/150?img=60',
      address: 'Railway Quarters, Dadar East, Mumbai - 400014',
      location: { lat: 19.0178, lng: 72.8478 },
      family_members: [],
    },
    created_at: '2026-02-24T07:30:00+05:30',
  },
  {
    id: 16,
    title: 'Power Grid Failure - Restored',
    description: 'Major power outage affecting 50,000 homes. Backup generators deployed. Power fully restored.',
    incident_type: 'OTHER',
    severity: 'HIGH',
    status: 'RESOLVED',
    location: { coordinates: [77.2090, 28.6139] },
    location_name: 'South Delhi',
    address: 'South Delhi',
    reporter: {
      name: 'Kavita Gupta', phone: '+91-4321098765', email: 'kavita.gupta@delhi.gov.in',
      role: 'CIVILIAN', avatar: 'https://i.pravatar.cc/150?img=32',
      address: 'C-34, Greater Kailash-1, New Delhi - 110048',
      location: { lat: 28.5494, lng: 77.2349 },
      family_members: [
        { name: 'Rakesh Gupta', relation: 'Husband', phone: '+91-4321098766' },
        { name: 'Aakash Gupta', relation: 'Son', phone: '+91-4321098767' },
      ],
    },
    created_at: '2026-02-04T23:10:00+05:30',
  },
  {
    id: 17,
    title: 'Festival Stampede Averted',
    description: 'Crowd control activated at temple festival. Barriers deployed, crowd dispersed safely.',
    incident_type: 'CRIME',
    severity: 'CRITICAL',
    status: 'RESOLVED',
    location: { coordinates: [83.0007, 25.3176] },
    location_name: 'Varanasi Ghats',
    address: 'Varanasi Ghats',
    reporter: {
      name: 'Rohit Tiwari', phone: '+91-3210987654', email: 'rohit.tiwari@uppol.gov.in',
      role: 'RESPONDER', avatar: 'https://i.pravatar.cc/150?img=51',
      address: 'Police Station, Dashashwamedh, Varanasi - 221001',
      location: { lat: 25.3109, lng: 83.0107 },
      family_members: [],
    },
    created_at: '2026-01-05T17:00:00+05:30',
  },
  {
    id: 18,
    title: 'Bridge Collapse - All Rescued',
    description: 'Old pedestrian bridge collapsed in heavy rain. 8 people rescued, minor injuries. Bridge demolished.',
    incident_type: 'NATURAL_DISASTER',
    severity: 'CRITICAL',
    status: 'RESOLVED',
    location: { coordinates: [72.8777, 19.0176] },
    location_name: 'Andheri East, Mumbai',
    address: 'Andheri East, Mumbai',
    reporter: {
      name: 'Neha Saxena', phone: '+91-2109876543', email: 'neha.saxena@bmc.gov.in',
      role: 'CIVILIAN', avatar: 'https://i.pravatar.cc/150?img=44',
      address: 'D-45, MIDC, Andheri East, Mumbai - 400093',
      location: { lat: 19.1136, lng: 72.8697 },
      family_members: [
        { name: 'Vivek Saxena', relation: 'Husband', phone: '+91-2109876544' },
      ],
    },
    created_at: '2026-02-14T12:30:00+05:30',
  },
  {
    id: 19,
    title: 'Oil Tanker Spill Cleaned',
    description: 'Oil tanker overturned on ring road causing fuel spill. Road cleaned, traffic restored after 4 hours.',
    incident_type: 'CHEMICAL_SPILL',
    severity: 'MEDIUM',
    status: 'RESOLVED',
    location: { coordinates: [76.9558, 11.0168] },
    location_name: 'Avinashi Road, Coimbatore',
    address: 'Avinashi Road, Coimbatore',
    reporter: {
      name: 'Ganesh Iyer', phone: '+91-1098765432', email: 'ganesh.iyer@tnfire.gov.in',
      role: 'CIVILIAN', avatar: 'https://i.pravatar.cc/150?img=57',
      address: '12, Race Course Road, Coimbatore - 641018',
      location: { lat: 11.0168, lng: 76.9558 },
      family_members: [],
    },
    created_at: '2026-02-28T03:45:00+05:30',
  },
  {
    id: 20,
    title: 'School Bus Accident - All Safe',
    description: 'School bus skidded on wet road and hit divider. All 32 students safely evacuated. Minor injuries.',
    incident_type: 'ROAD_ACCIDENT',
    severity: 'HIGH',
    status: 'RESOLVED',
    location: { coordinates: [76.2711, 10.8505] },
    location_name: 'MG Road, Kochi',
    address: 'MG Road, Kochi',
    reporter: {
      name: 'Lakshmi Menon', phone: '+91-9876501234', email: 'lakshmi.menon@gmail.com',
      role: 'VOLUNTEER', avatar: 'https://i.pravatar.cc/150?img=26',
      address: '7, Banerji Road, Ernakulam, Kochi - 682018',
      location: { lat: 9.9816, lng: 76.2999 },
      family_members: [
        { name: 'Arun Menon', relation: 'Husband', phone: '+91-9876501235' },
        { name: 'Maya Menon', relation: 'Daughter', phone: '+91-9876501236' },
      ],
    },
    created_at: '2026-03-05T07:45:00+05:30',
  },
]

// ── Async Thunks ──

export const fetchIncidents = createAsyncThunk(
  'incidents/fetchAll',
  async (params, { rejectWithValue }) => {
    try {
      const data = await incidentService.getAll(params)
      return data.results || data  // DRF pagination returns { results: [] }
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const fetchIncidentStats = createAsyncThunk(
  'incidents/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      return await incidentService.getStats()
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

export const resolveIncident = createAsyncThunk(
  'incidents/resolve',
  async (incidentId, { rejectWithValue }) => {
    try {
      await incidentService.resolve(incidentId)
      return incidentId
    } catch (error) {
      return rejectWithValue(error.message)
    }
  }
)

// ── Slice ──

export const incidentSlice = createSlice({
  name: 'incidents',
  initialState: {
    items: sampleIncidents,       // sample data as fallback
    selectedIncident: null,
    isLoading: false,
    error: null,
    usingLiveData: false,         // true when fetched from API
    stats: {
      total: sampleIncidents.length,
      active: sampleIncidents.filter(i => i.status !== 'RESOLVED').length,
      resolved: sampleIncidents.filter(i => i.status === 'RESOLVED').length,
    },
    filters: {
      status: 'all',
      severity: 'all',
      incident_type: 'all',
    },
  },

  reducers: {
    selectIncident: (state, action) => {
      state.selectedIncident = action.payload
    },
    clearSelection: (state) => {
      state.selectedIncident = null
    },
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload }
    },
    updateIncidentRealtime: (state, action) => {
      const idx = state.items.findIndex(i => i.id === action.payload.id)
      if (idx !== -1) {
        state.items[idx] = { ...state.items[idx], ...action.payload }
      }
    },
    addIncident: (state, action) => {
      state.items.unshift(action.payload)
      state.stats.total++
      state.stats.active++
    },
  },

  extraReducers: (builder) => {
    builder
      // Fetch incidents
      .addCase(fetchIncidents.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchIncidents.fulfilled, (state, action) => {
        state.isLoading = false
        state.items = action.payload
        state.usingLiveData = true
        state.stats = {
          total: action.payload.length,
          active: action.payload.filter(i => i.status !== 'RESOLVED').length,
          resolved: action.payload.filter(i => i.status === 'RESOLVED').length,
        }
      })
      .addCase(fetchIncidents.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
        // Keep sample data as fallback — no items overwrite
      })
      // Stats
      .addCase(fetchIncidentStats.fulfilled, (state, action) => {
        state.stats = { ...state.stats, ...action.payload }
      })
      // Resolve
      .addCase(resolveIncident.fulfilled, (state, action) => {
        const idx = state.items.findIndex(i => i.id === action.payload)
        if (idx !== -1) {
          state.items[idx].status = 'RESOLVED'
          state.stats.active--
          state.stats.resolved++
        }
      })
  },
})

export const {
  selectIncident,
  clearSelection,
  setFilters,
  updateIncidentRealtime,
  addIncident,
} = incidentSlice.actions
export default incidentSlice.reducer

