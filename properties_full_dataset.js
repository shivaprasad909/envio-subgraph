/****************************************************
* One column per field (by block), one row per item
* Google Apps Script for Google Sheets
    * Version: multi-tab (each class to its own tab) + PAGINATION
* Prefixes removed: headers use raw attribute names (snake_case)
                                              * Every row starts with: DSWL id + ISO datetime + propertyHash + full address
                                                                                                                    ****************************************************/

// ---------------------------
   // Field sets by block (match your query; headers will use these names verbatim)
// ---------------------------
const ADDRESS_FIELDS = [
"county_name","street_number","street_suffix","street_name",
"street_direction_suffix","street_direction_prefix","state_code",
"longitude","latitude","city_name","country_code","postal_code","lot",
"municipality_name","plus_four_postal_code","id","range","section",
"route_number","township","unit_identifier"
];

const COMPANY_FIELDS = ["id","name"]; // array block

const FILE_FIELDS = [ // array block (note: includes property_id)
"file_format","document_type","id","ipfs_url","name","original_url","property_id"
];

const FLOOD_FIELDS = [
"community_id","effective_date","evacuation_zone","fema_search_url",
"flood_insurance_required","flood_zone","map_version","panel_number","id"
];

const LAYOUT_FIELDS = [ // array block
"clutter_level","cabinet_style","condition_issues","countertop_material",
"decor_elements","design_style","fixture_finish_quality","floor_level",
"flooring_material_type","flooring_wear","furnished","has_windows","id",
"is_exterior","is_finished","lighting_features","natural_light_quality",
"paint_condition","pool_condition","pool_equipment","pool_surface_type",
"pool_type","pool_water_quality","safety_features","size_square_feet",
"spa_type","space_index","space_type","view_type","visible_damage",
"window_design_type","window_material_type","window_treatment_type"
];

const LOT_FIELDS = [
"driveway_condition","driveway_material","fence_height","fence_length",
"fencing_type","id","landscaping_features","lot_area_sqft",
"lot_condition_issues","lot_length_feet","lot_size_acre","lot_type",
"lot_width_feet","view"
];

const PROPERTY_FIELDS = [
"area_under_air","historic_designation","livable_floor_area",
"number_of_units","number_of_units_type","parcel_identifier",
"property_effective_built_year","property_legal_description_text",
"property_structure_built_year","property_type","subdivision",
"total_area","zoning","id"
];

const SALES_HISTORY_FIELDS = [ // array block
"sale_type","purchase_price_amount","ownership_transfer_date","id"
];

const STRUCTURE_FIELDS = [
"roof_date","architectural_style_type","attachment_type","ceiling_condition",
"ceiling_height_average","ceiling_insulation_type","ceiling_structure_material",
"ceiling_surface_material","exterior_door_material","exterior_wall_condition",
"exterior_wall_insulation_type","exterior_wall_material_primary",
"exterior_wall_material_secondary","flooring_condition","flooring_material_primary",
"flooring_material_secondary","foundation_condition","foundation_material",
"foundation_type","foundation_waterproofing","gutters_condition","gutters_material",
"id","interior_door_material","interior_wall_condition","interior_wall_finish_primary",
"interior_wall_finish_secondary","interior_wall_structure_material",
"interior_wall_surface_material_primary","interior_wall_surface_material_secondary",
"number_of_stories","primary_framing_material","roof_age_years","roof_condition",
"roof_covering_material","roof_design_type","roof_material_type",
"roof_structure_material","roof_underlayment_type","secondary_framing_material",
"structural_damage_indicators","subfloor_material","window_frame_material",
"window_glazing_type","window_operation_type","window_screen_material"
];

const TAX_FIELDS = [ // array block
"first_year_building_on_tax_roll","first_year_on_tax_roll","id",
"monthly_tax_amount","period_end_date","period_start_date",
"property_assessed_value_amount","property_building_amount",
"property_land_amount","property_market_value_amount",
"property_taxable_value_amount","tax_year","yearly_tax_amount"
];

const PERSON_FIELDS = [ // array block
"first_name","last_name","middle_name","prefix_name","suffix_name",
"us_citizenship_status","veteran_status","birth_date","id"
];

const UTILITY_FIELDS = [
"cooling_system_type","electrical_panel_capacity","electrical_wiring_type",
"electrical_wiring_type_other_description","heating_system_type",
"hvac_condensing_unit_present","hvac_unit_condition","hvac_unit_issues","id",
"plumbing_system_type","plumbing_system_type_other_description",
"public_utility_type","sewer_type","smart_home_features",
"smart_home_features_other_description","solar_inverter_visible",
"solar_panel_present","solar_panel_type","solar_panel_type_other_description",
"water_source_type"
];

const IPFS_FIELDS = ["id","ipfs_url","full_generation_command"]; // singleton

                                                                    // Meta tab (derived)
const META_FIELDS = [
"full_address",
"ipfs_gateway_url",
"dswl_datetime_iso",
"property_hash"
];

// ---------------------------
   // Common identifier columns (prefix on EVERY tab)
// ---------------------------
const COMMON_KEYS = [
"dswl_id",             // DataSubmittedWithLabel.id
"dswl_datetime_iso",   // ISO conversion from epoch string
"property_hash",       // propertyHash
"full_address"         // derived from address
];

// ---------------------------
   // Column / Header helpers
                      // ---------------------------
function makeHeadersForTab(fields) {
// Use raw attribute names as-is, no "Address:" etc.
return [...COMMON_KEYS, ...fields];
}

// Registry of tabs
const TAB_DEFS = [
{ name: "Address",       blockKey: "address",                 fields: ADDRESS_FIELDS },
{ name: "Property",      blockKey: "property",                fields: PROPERTY_FIELDS },
{ name: "Structure",     blockKey: "structure",               fields: STRUCTURE_FIELDS },
{ name: "Flood",         blockKey: "flood_storm_information", fields: FLOOD_FIELDS },
{ name: "Lot",           blockKey: "lot",                     fields: LOT_FIELDS },
{ name: "Layouts",       blockKey: "layouts",                 fields: LAYOUT_FIELDS,        isArray: true },
{ name: "Files",         blockKey: "files",                   fields: FILE_FIELDS,          isArray: true },
{ name: "Sales_History", blockKey: "sales_history",           fields: SALES_HISTORY_FIELDS, isArray: true },
{ name: "Companies",     blockKey: "companies",               fields: COMPANY_FIELDS,       isArray: true },
{ name: "Persons",       blockKey: "persons",                 fields: PERSON_FIELDS,        isArray: true },
{ name: "Utility",       blockKey: "utility",                 fields: UTILITY_FIELDS },
{ name: "Tax",           blockKey: "tax",                     fields: TAX_FIELDS,           isArray: true },
{ name: "IPFS",          blockKey: "ipfs",                    fields: IPFS_FIELDS },
{ name: "Meta",          blockKey: "__meta__",                fields: META_FIELDS,          special: "meta" }
];

// ---------------------------
   // GraphQL (PAGINATED VERSION of your query)
// ---------------------------
const QUERY_PAGED = `
query MyQuery($limit: Int!, $offset: Int!) {
DataSubmittedWithLabel(limit: $limit, offset: $offset) {
    propertyHash
datetime
id
utility {
    cooling_system_type
electrical_panel_capacity
electrical_wiring_type
electrical_wiring_type_other_description
heating_system_type
hvac_condensing_unit_present
hvac_unit_condition
hvac_unit_issues
id
plumbing_system_type
plumbing_system_type_other_description
public_utility_type
sewer_type
smart_home_features
smart_home_features_other_description
solar_inverter_visible
solar_panel_present
solar_panel_type
solar_panel_type_other_description
water_source_type
}
tax {
    first_year_building_on_tax_roll
first_year_on_tax_roll
id
monthly_tax_amount
period_end_date
period_start_date
property_assessed_value_amount
property_building_amount
property_land_amount
property_market_value_amount
property_taxable_value_amount
tax_year
yearly_tax_amount
}
structure {
    roof_date
architectural_style_type
attachment_type
ceiling_condition
ceiling_height_average
ceiling_insulation_type
ceiling_structure_material
ceiling_surface_material
exterior_door_material
exterior_wall_condition
exterior_wall_insulation_type
exterior_wall_material_primary
exterior_wall_material_secondary
flooring_condition
flooring_material_primary
flooring_material_secondary
foundation_condition
foundation_material
foundation_type
foundation_waterproofing
gutters_condition
gutters_material
id
interior_door_material
interior_wall_condition
interior_wall_finish_primary
interior_wall_finish_secondary
interior_wall_structure_material
interior_wall_surface_material_primary
interior_wall_surface_material_secondary
number_of_stories
primary_framing_material
roof_age_years
roof_condition
roof_covering_material
roof_design_type
roof_material_type
roof_structure_material
roof_underlayment_type
secondary_framing_material
structural_damage_indicators
subfloor_material
window_frame_material
window_glazing_type
window_operation_type
window_screen_material
}
sales_history {
    sale_type
purchase_price_amount
ownership_transfer_date
id
}
property {
    area_under_air
historic_designation
livable_floor_area
number_of_units
number_of_units_type
parcel_identifier
property_effective_built_year
property_legal_description_text
property_structure_built_year
property_type
subdivision
total_area
zoning
id
}
persons {
    first_name
last_name
middle_name
prefix_name
suffix_name
us_citizenship_status
veteran_status
birth_date
id
}
lot {
    driveway_condition
driveway_material
fence_height
fence_length
fencing_type
id
landscaping_features
lot_area_sqft
lot_condition_issues
lot_length_feet
lot_size_acre
lot_type
lot_width_feet
view
}
layouts {
    clutter_level
cabinet_style
condition_issues
countertop_material
decor_elements
design_style
fixture_finish_quality
floor_level
flooring_material_type
flooring_wear
furnished
has_windows
id
is_exterior
is_finished
lighting_features
natural_light_quality
paint_condition
pool_condition
pool_equipment
pool_surface_type
pool_type
pool_water_quality
safety_features
size_square_feet
spa_type
space_index
space_type
view_type
visible_damage
window_design_type
window_material_type
window_treatment_type
}
ipfs {
    ipfs_url
id
full_generation_command
}
flood_storm_information {
    community_id
effective_date
evacuation_zone
fema_search_url
flood_insurance_required
flood_zone
map_version
panel_number
id
}
files {
    file_format
document_type
id
ipfs_url
name
original_url
property_id
}
companies {
    name
id
}
address {
    county_name
street_number
street_suffix
street_name
street_direction_suffix
street_direction_prefix
state_code
longitude
latitude
city_name
country_code
postal_code
lot
municipality_name
plus_four_postal_code
id
range
section
route_number
township
unit_identifier
}
}
}
`;

// ---------------------------
   // Helpers
   // ---------------------------
function uniqueJoin(values) {
const set = [];
for (const v of values) {
    const s = v == null ? "" : String(v);
if (s && !set.includes(s)) set.push(s);
}
return set.join("; ");
}

function toGatewayUrl(input, gateway) {
if (!input) return "";
const gw = (gateway || "https://ipfs.io").replace(/\/+$/, "");
let s = String(input).trim();

// If it's already http(s), just ensure trailing slash when path ends with /ipfs/<cid>
if (/^https?:\/\//i.test(s)) {
if (!/[?#]/.test(s) && /\/ipfs\/[^/]+$/.test(s)) s += "/";
return s;
}

// Normalize ipfs:// and ipfs/ prefixes → <cid>[/path]
s = s.replace(/^ipfs:\/\//i, "").replace(/^ipfs\//i, "");

// Split off CID and optional path
const parts = s.split(/[?#]/)[0].split("/");
const cid = parts.shift() || "";
const path = parts.length ? "/" + parts.join("/") : "/";

return `${gw}/ipfs/${cid}${path}`;
}


function oneLineAddress(a) {
if (!a) return "";
const left = [
                 a.street_number, a.street_direction_prefix, a.street_name,
                 a.street_suffix, a.street_direction_suffix
             ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
const unit = a.unit_identifier ? ` #${a.unit_identifier}` : "";
const cityState = [a.city_name, a.state_code].filter(Boolean).join(", ");
const right = [cityState, a.postal_code].filter(Boolean).join(" ").trim();
return [left + unit, right].filter(Boolean).join(" ").trim();
}

function toISOFromEpochString(epochStr) {
if (!epochStr) return "";
const n = Number(epochStr);
if (!isFinite(n)) return "";
// epoch is in seconds
return new Date(n * 1000).toISOString();
}

function headersDiffer(sheet, desired) {
const range = sheet.getRange(1, 1, 1, desired.length);
const values = range.getValues()[0] || [];
if (values.length !== desired.length) return true;
for (let i = 0; i < desired.length; i++) {
if (String(values[i] || "") !== String(desired[i] || "")) return true;
}
return false;
}

function ensureHeader(sheetName, headers) {
const ss = SpreadsheetApp.getActiveSpreadsheet();
const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
if (headersDiffer(sheet, headers)) {
sheet.clear();
sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
SpreadsheetApp.flush();
}
return sheet;
}

function fetchWithRetry(url, options, { retries = 3, baseDelayMs = 600 } = {}) {
let lastErr;
for (let attempt = 0; attempt <= retries; attempt++) {
    try {
return UrlFetchApp.fetch(url, options);
} catch (e) {
lastErr = e;
if (attempt === retries) break;
Utilities.sleep(baseDelayMs * Math.pow(2, attempt)); // backoff
}
}
throw lastErr;
}

// Extractor for block fields
function blockValue(item, blockName, field) {
const blk = item?.[blockName];
if (!blk) return "";
// singleton object
if (!Array.isArray(blk)) {
const v = blk?.[field];
if (Array.isArray(v)) return uniqueJoin(v);
if (v && typeof v === "object") return JSON.stringify(v);
return v ?? "";
}
// array block: collect field across entries
const vals = blk.map(b => b?.[field]).filter(v => v != null && v !== "");
const flat = [];
for (const val of vals) {
if (Array.isArray(val)) flat.push(...val);
else if (val && typeof val === "object") flat.push(JSON.stringify(val)); // defensive
else flat.push(val);
}
return uniqueJoin(flat);
}

// Common identifiers for every row
function buildCommonKeys(item) {
return [
    item?.id ?? "",                           // dswl_id
toISOFromEpochString(item?.datetime),     // dswl_datetime_iso
item?.propertyHash ?? "",                 // property_hash
oneLineAddress(item.address)              // full_address
];
}

// Build a row for a given tab
function buildRowForTab(item, tabDef) {
if (tabDef.special === "meta") {
const common = buildCommonKeys(item);
const metaVals = [
oneLineAddress(item.address),
toGatewayUrl(item?.ipfs?.ipfs_url),     // ipfs_gateway_url
toISOFromEpochString(item?.datetime),
item?.propertyHash ?? ""
];
return [...common, ...metaVals];
}

const common = buildCommonKeys(item);
const fields = tabDef.fields.map(f => {
    let v = blockValue(item, tabDef.blockKey, f);

// Fix ONLY the run-ipfs (or IPFS) tab ipfs_url column
if ((tabDef.name === "run-ipfs" || tabDef.blockKey === "ipfs") && f === "ipfs_url") {
    let g = toGatewayUrl(v);
if (/^https?:\/\/[^/]+\/ipfs\/[^/]+$/i.test(g)) g += "/"; // ensure trailing slash
return g;
}
return v;
});

return [...common, ...fields];
}


// ---------------------------
   // Main: run paginated query and write each class to its own tab
// ---------------------------
/**
* - sheetPrefix: prefix for each tab (e.g., "Run - "), or "" for none
* - indexerUrl: GraphQL endpoint
* - pageSize: page size for pagination (default 1000)
*/
function runMultiTabPaged({ sheetPrefix = "", indexerUrl, pageSize = 1000 }) {
    const startTime = new Date();
console.log(`=== ${sheetPrefix || "MultiTab"} started at: ${startTime.toISOString()} ===`);

// Prepare headers & sheets for all tabs
const sheets = {};
const headersByTab = {};
const nextRowByTab = {};

TAB_DEFS.forEach(def => {
    const headers = (def.special === "meta")
? [...COMMON_KEYS, ...META_FIELDS]
: makeHeadersForTab(def.fields);

const sheetName = `${sheetPrefix}${def.name}`;
headersByTab[def.name] = headers;
const sheet = ensureHeader(sheetName, headers);
sheets[def.name] = sheet;
nextRowByTab[def.name] = 2; // start after header
});

let offset = 0, batch = 0;
while (true) {
batch++;
const payload = { query: QUERY_PAGED, variables: { limit: pageSize, offset } };
const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
};

console.log(`[Paged] Fetching batch ${batch} (offset ${offset}, limit ${pageSize}) from ${indexerUrl}...`);
const resp = fetchWithRetry(indexerUrl, options, { retries: 3, baseDelayMs: 800 });
const status = resp.getResponseCode();
if (status < 200 || status >= 300) {
    const body = resp.getContentText();
console.error(`[Paged] HTTP ${status}: ${body.slice(0, 800)}`);
throw new Error(`[Paged] Request failed with status ${status}`);
}

const json = JSON.parse(resp.getContentText());
if (json.errors) {
console.error(`[Paged] GraphQL errors: ${JSON.stringify(json.errors)}`);
throw new Error(`[Paged] GraphQL error(s) encountered`);
}

const items = json?.data?.DataSubmittedWithLabel || [];
console.log(`[Paged] Batch ${batch} rows: ${items.length}`);

if (!items.length) {
console.log(`[Paged] No more rows. Done.`);
break;
}

// For each tab, build its rows from this batch and write once
TAB_DEFS.forEach(def => {
    const rows = items.map(item => buildRowForTab(item, def));
const sheet = sheets[def.name];
const startRow = nextRowByTab[def.name];
const headers = headersByTab[def.name];

if (rows.length) {
sheet.getRange(startRow, 1, rows.length, headers.length).setValues(rows);
SpreadsheetApp.flush();
nextRowByTab[def.name] += rows.length;
console.log(`[${def.name}] Wrote ${rows.length} rows starting at row ${startRow}`);
}
});

offset += pageSize;
if (items.length < pageSize) {
    console.log(`[Paged] Last page detected (results < limit).`);
break;
}
}

// Clean stale rows per tab (keep headers)
TAB_DEFS.forEach(def => {
    const sheet = sheets[def.name];
const expectedLast = nextRowByTab[def.name] - 1; // last written row
const lastRow = sheet.getLastRow();
const headersLen = headersByTab[def.name].length;
if (lastRow > expectedLast) {
const rowsToClear = lastRow - expectedLast;
sheet.getRange(expectedLast + 1, 1, rowsToClear, headersLen).clearContent();
console.log(`[${def.name}] Cleared ${rowsToClear} stale row(s).`);
}
});

console.log(`=== ${sheetPrefix || "MultiTab"} finished in ${new Date() - startTime} ms ===`);
}

// ---------------------------
   // Example runner
              // ---------------------------
function fetchAllToTabs() {
    const INDEXER_URL = "ADD_YOUR_INDEXER_URL";
// Creates tabs: Address, Property, Structure, Flood, Lot, Layouts,
// Files, Sales_History, Companies, Persons, Utility, Tax, IPFS, Meta
runMultiTabPaged({
    sheetPrefix: "Run - ",
    indexerUrl: INDEXER_URL,
    pageSize: 1000 // adjust as needed
});
}

/***** Optional trigger *****/
function createTrigger() {
    ScriptApp.newTrigger("fetchAllToTabs").timeBased().everyHours(1).create();
}
