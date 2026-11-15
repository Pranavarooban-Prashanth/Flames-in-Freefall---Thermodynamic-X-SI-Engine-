import { KnowledgePassage } from '../types/combustion';

/**
 * Curated report & dissertation passage knowledge base representing extracted excerpts
 * from NASA PSI final reports, Princeton summary metadata, and USC cool-flame studies.
 */
export const BASELINE_KNOWLEDGE_BASE: KnowledgePassage[] = [
  {
    id: 'kb-flex-1',
    experiment_id: 'PSI 69',
    experiment_name: 'FLEX',
    title: 'Dual-Stage Radiative Extinction & Cool-Flame Transition (~1200 K)',
    source_file: 'FLEX_Final_Report_Nayagam_Williams.pdf',
    page_or_section: 'Section 3.2 — Radiative Extinction Threshold',
    text: 'In microgravity droplet combustion of n-heptane and n-dodecane at 1 atm air, large initial droplets (D0 > 2.5 mm) suffer excessive radiative heat loss as the flame standoff expands. When flame temperature drops below approximately 1200 K, the luminous hot flame undergoes radiative extinction and transitions immediately into a quasi-steady, invisible low-temperature cool flame sustained by NTC peroxide kinetics.',
    tags: ['cool flame', 'radiative extinction', '1200 K', 'n-heptane', 'droplet', 'FLEX'],
    doi_url: 'http://doi.org/10.60555/mbq8-0451'
  },
  {
    id: 'kb-flex2-1',
    experiment_id: 'PSI 68',
    experiment_name: 'FLEX-2',
    title: 'Pressure & Chain-Length Promotion of Cool Flames in n-Dodecane',
    source_file: 'FLEX2_Science_Requirements_Dryer.pdf',
    page_or_section: 'Section 4.1 — Elevated Pressure Kinetics',
    text: 'Elevated ambient pressures (2 to 3 atm) and longer alkane chain lengths (n-dodecane vs n-heptane) substantially widen the cool-flame stability envelope. In 21% O2/N2 at 3 atm, n-dodecane droplets reliably sustain secondary cool-flame vaporization down to sub-millimeter extinction diameters (~0.22 mm) with lower peak temperatures (~860 K) and tighter standoff ratios (d_f/d_d ~ 2.1).',
    tags: ['n-dodecane', 'pressure', 'cool flame', 'extinction diameter', 'FLEX-2'],
    doi_url: 'http://doi.org/10.60555/byp8-h018'
  },
  {
    id: 'kb-cfi-1',
    experiment_id: 'PSI 39',
    experiment_name: 'CFI',
    title: 'Hidden Fire Hazard of Non-Luminous Cool Flames',
    source_file: 'CFI_USC_CoolFlame_Presentation_Farouk.pdf',
    page_or_section: 'Slide 14 — Operational Fire Detection Implications',
    text: 'Cool flames emit negligible visible radiation and minimal soot, making them difficult to detect with standard optical flame sensors while continuing to consume oxygen and generate toxic partial-oxidation species (CO, formaldehyde, peroxides). External thermo-convective perturbations (2–5 cm/s) can re-ignite a lingering cool flame back into a full hot diffusion flame.',
    tags: ['cool flame', 'hidden hazard', 're-ignition', 'CFI', 'Farouk', 'convection'],
    doi_url: 'http://doi.org/10.60555/m6pj-a914'
  },
  {
    id: 'kb-psi117-1',
    experiment_id: 'PSI 117',
    experiment_name: 'Cool Flame CFD',
    title: 'Thermo-Convective Drift and Multi-Stage Oscillations',
    source_file: 'PSI117_Farouk_Hicks_CFD_Report.pdf',
    page_or_section: 'Section 5 — Perturbation Dynamics',
    text: 'Multi-physics CFD anchored to ISS FLEX observations demonstrates that gentle ventilation flows (2.5–5.0 cm/s) compress the upstream cool-flame standoff and increase oxygen transport into the low-temperature reaction zone, driving oscillatory or multi-stage re-ignition transitions at elevated pressures.',
    tags: ['CFD', 'oscillatory', 'convective', 'cool flame', 'Farouk', 'Hicks'],
    doi_url: 'http://doi.org/10.60555/gz0q-b577'
  },
  {
    id: 'kb-cfig-1',
    experiment_id: 'PSI 159',
    experiment_name: 'ACME CFI-G',
    title: 'Gaseous Spherical Cool Flames Without Chemical Additives',
    source_file: 'ACME_CFIG_Final_Report_Sunderland.pdf',
    page_or_section: 'Section 2 — Experimental Observations',
    text: 'ACME CFI-G confirmed that gaseous fuels such as dimethyl ether and n-butane sustain spherical diffusion cool flames on porous burners at 1.5–2.0 atm without plasma or ozone seeding, establishing that low-temperature ignition risk extends to gaseous propellant and coolant leaks in spacecraft habitats.',
    tags: ['ACME', 'CFI-G', 'gas', 'cool flame', 'dimethyl ether', 'butane'],
    doi_url: 'http://doi.org/10.60555/cyt1-kh64'
  },
  {
    id: 'kb-fd-1',
    experiment_id: 'PSI 10',
    experiment_name: 'ACME Flame Design',
    title: 'Diluent Thermal-Diffusive Effects (He vs CO2 vs N2)',
    source_file: 'ACME_Flame_Design_Axelbaum_Report.pdf',
    page_or_section: 'Section 3.4 — Inert Diluent Substitution',
    text: 'Replacing N2 with helium increases mixture thermal conductivity and Lewis number, raising conductive heat loss and enlarging extinction diameters; replacing N2 with CO2 increases molar heat capacity and gas-phase radiative absorption, sharply lowering peak flame temperature and raising the Limiting Oxygen Index.',
    tags: ['Helium', 'CO2', 'N2', 'diluent', 'radiative loss', 'Flame Design'],
    doi_url: 'http://doi.org/10.60555/w4zy-bt45'
  },
  {
    id: 'kb-bre-1',
    experiment_id: 'PSI 20',
    experiment_name: 'ACME BRE',
    title: 'Exploration Atmosphere Flammability Limits (34% O2 / 56.5 kPa)',
    source_file: 'ACME_BRE_Quintiere_Final_Report.pdf',
    page_or_section: 'Section 6 — Exploration Atmosphere Screening',
    text: 'Under proposed NASA Lunar/Mars exploration cabin atmospheres (30–34% O2 at reduced total pressure ~56.5 kPa / 8.2 psi), reduced total pressure lowers convective buoyancy and alters gas-phase kinetics, while elevated O2 mole fraction dramatically increases flame heat flux and lowers extinction margins for polymeric materials like PMMA and cotton.',
    tags: ['BRE', 'exploration atmosphere', 'Lunar', 'Mars', '34% O2', '56.5 kPa'],
    doi_url: 'http://doi.org/10.60555/vb93-3y72'
  },
  {
    id: 'kb-bass-1',
    experiment_id: 'BASS / BASS-II',
    experiment_name: 'BASS & BASS-II',
    title: 'Low-Flow Microgravity Flammability Extension Below 1g LOI',
    source_file: 'BASS_II_Olson_Ferkul_Report.pdf',
    page_or_section: 'Section 4 — Concurrent & Opposed Flow Extinction',
    text: 'BASS and BASS-II proved that at low forced ventilation speeds (5–15 cm/s) in microgravity, thin cellulosic fabrics and PMMA rods sustain flame spread at oxygen concentrations (16–17.5% O2) below their normal-gravity 1-g NASA-STD-6001 upward flammability limit (~18–19% O2), because absence of buoyant convection reduces convective flame stretch and heat loss.',
    tags: ['BASS', 'LOI', 'low flow', 'microgravity', 'PMMA', 'cotton', 'NASA-STD-6001'],
    doi_url: 'https://psi.nasa.gov/physci/repo/search?q=BASS'
  },
  {
    id: 'kb-saffire-1',
    experiment_id: 'PSI 98',
    experiment_name: 'SAFFIRE-I / II / III',
    title: 'Large-Scale Spacecraft Fire Growth vs Flow Velocity',
    source_file: 'SAFFIRE_Urban_Ruff_Synthesis.pdf',
    page_or_section: 'Section 3 — Cygnus Duct Flame Spread',
    text: 'Across SAFFIRE-I (20 cm/s) and SAFFIRE-III (30 cm/s), large-scale SIBAL cotton-fiberglass sheets exhibited rapid, nearly steady concurrent flame spread (8–11 mm/s) without self-extinguishment at 21% O2, whereas Nomex remained non-propagating at 21% O2 / 101.3 kPa under 20–30 cm/s airflow.',
    tags: ['SAFFIRE', 'SIBAL', 'Nomex', 'flow velocity', 'large scale', 'Cygnus'],
    doi_url: 'http://doi.org/10.60555/0t15-1z43'
  },
  {
    id: 'kb-same-1',
    experiment_id: 'PSI 102',
    experiment_name: 'SAME & SAME-R',
    title: 'Microgravity Smoke Aerosol Size Shifts & Detector Calibration',
    source_file: 'SAME_Urban_Mulholland_Report.pdf',
    page_or_section: 'Section 2.3 — Coagulation in Zero Buoyancy',
    text: 'Without buoyancy-driven mixing, smoke aerosols generated from overheated Kapton, Teflon, and cellulose undergo longer residence times near the source, shifting particle size distributions toward larger agglomerates (0.3–1.0 micron) compared to 1-g tests and altering ionization vs photoelectric detector sensitivity.',
    tags: ['SAME', 'smoke', 'aerosol', 'Kapton', 'Teflon', 'detection'],
    doi_url: 'http://doi.org/10.60555/gd4k-8h62'
  },
  {
    id: 'kb-spice-1',
    experiment_id: 'PSI 107',
    experiment_name: 'SPICE & SLICE',
    title: 'Microgravity Soot Inception & Coflow Flame Liftoff',
    source_file: 'SPICE_SLICE_Sunderland_Long_Report.pdf',
    page_or_section: 'Section 4 — Laminar Smoke Point & Liftoff',
    text: 'In microgravity coflow diffusion flames (SPICE and SLICE), elimination of buoyant acceleration increases soot residence time, causing ethylene flames to reach smoke-point soot emission at lower fuel flow rates than on Earth while methane flames lift off cleanly above 30 cm/s coflow.',
    tags: ['SPICE', 'SLICE', 'soot', 'liftoff', 'ethylene', 'methane'],
    doi_url: 'http://doi.org/10.60555/9kbh-e962'
  }
];
