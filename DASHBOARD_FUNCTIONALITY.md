# Dashboard Functionality Snapshot

## Overview
The Custodia Dashboard is a real-time animal tracking system that visualizes GPS location data on an interactive map with comprehensive filtering, statistics, and management capabilities.

---

## 1. HEADER BAR

### Features:
- **Logo & Branding**: Custodia logo with link to landing page
- **Last Update Time**: Shows when data was last refreshed from the database
- **Download CSV Button**: Downloads filtered location data as CSV file
- **Refresh Button**: Reloads all data from the database

### CSV Export Fields:
- tracker_id
- tracker_name
- tracker_family
- tracker_type
- tracker_status
- lat
- long
- timestamp

---

## 2. LEFT SIDEBAR

### A. Tracked Animals Header
- Shows count of active tracked animals
- Updates dynamically based on filters

### B. Filters Section (Collapsible)
**Default State**: Collapsed (hidden)

#### Filter Options:

1. **Filter by Tracker**
   - Multi-select list of all trackers
   - "Select All" / "Deselect All" toggle button
   - Individual tracker selection
   - Shows tracker name and ID

2. **Filter by Status**
   - All Status
   - Active (recent updates, good battery)
   - Inactive (no recent updates)
   - Alert (low battery or issues)

3. **Filter by Animal Type**
   - Dropdown with all unique animal types
   - Dynamic population from database
   - "All Types" option

4. **Filter by Family**
   - Dropdown with all unique families
   - Dynamic population from database
   - "All Families" option

5. **Date Range Filters**
   - **Date From**: Start date (defaults to earliest data date, min = earliest date)
   - **Date To**: End date (defaults to today, max = today)
   - Filters locations within specified date range
   - Uses detected timezone for accurate filtering

6. **Visualization Mode**
   - **Only Markers**: Individual location markers only
   - **Show Path**: Markers connected with polylines
   - **Show Path with Directions**: Markers, polylines, and directional arrows

7. **Show Distance Between Markers** (Conditional)
   - Only visible when "Show Path" or "Show Path with Directions" is selected
   - Checkbox to toggle distance labels on path lines
   - Distance displayed in km or meters

### C. Animal List
- Scrollable list of all tracked animals
- Each entry shows:
  - **Animal Name** with edit button
  - **Status Badge** (Active/Inactive/Alert) with color coding
  - **Type**: Animal species/category
  - **Family**: Taxonomic grouping
  - **Last Update**: Formatted timestamp (e.g., "2h ago", "11/18/2025 02:18 PM")
  - **Battery**: Voltage and percentage (e.g., "3.30V (100%)")
  - **Total Distance**: Cumulative distance traveled (e.g., "72.5 km")
  - **Avg Distance/Day**: Average daily movement (e.g., "4.81 km")

- **Click Behavior**: 
  - Clicking an animal selects it and zooms map to its last location
  - Toggles marker popups visibility
  - Highlights selected animal

---

## 3. MAIN CONTENT AREA

### A. Statistics Cards (Top Row)

1. **Total Locations**
   - Count of all location points currently displayed
   - Updates based on active filters
   - Icon: Green location pin

2. **Avg Update Time**
   - Average time since last update across all filtered trackers
   - Calculated from each tracker's last update timestamp
   - Format: "30m", "5h", "2d" (minutes/hours/days)
   - Shows "--" if no valid update times found
   - Icon: Green clock

3. **Avg Battery**
   - Average battery percentage across all filtered trackers
   - Calculated from battery voltage and initial voltage
   - Format: "97%" or "N/A"
   - Icon: Green battery

4. **Active Alerts**
   - Count of trackers with "alert" status
   - Icon: Green warning triangle

### B. Interactive Map (Leaflet.js)

#### Map Features:
- **Zoom Controls**: Zoom in/out buttons
- **Center Map Button**: Centers view on all visible animals
- **Geographic Context**: Roads, cities, landmarks (Arabic labels supported)

#### Marker Types:
- **Regular Markers**: Circular markers with animal-specific colors
- **Last Location Marker**: Larger marker (24px) for most recent location
- **Previous Locations**: Smaller markers (16-18px) for historical locations

#### Marker Popups:
Each marker shows:
- Animal name (bold)
- Type
- Family
- Time: Formatted timestamp in detected timezone
- Battery: Voltage and percentage
- **Distance from previous**: Distance from previous location (always shown)
- Location count: "Location X of Y"

#### Visualization Modes:

1. **Only Markers Mode**
   - Individual location markers
   - No connections between points
   - Popups show location details

2. **Show Path Mode**
   - Markers connected with colored polylines
   - Color matches animal's assigned color
   - Optional distance labels along path (if checkbox enabled)
   - Distance labels positioned to avoid overlap (15% and 85% along segments)

3. **Show Path with Directions Mode**
   - Markers connected with polylines
   - Directional arrows at midpoint of each segment
   - Optional distance labels (positioned at 15% and 85% to avoid arrow overlap)
   - Arrows have higher z-index than labels for visibility

#### Distance Labels:
- Styled as white boxes with colored borders
- Show distance in km (e.g., "3.12 km") or meters
- Smaller box sizes for cleaner appearance
- Positioned along path lines when checkbox is enabled

---

## 4. EDIT TRACKER MODAL

### Access:
- Click edit button (pencil icon) next to animal name in sidebar list

### Fields:

1. **Animal Name**
   - Text input
   - Required field
   - Updates tracker name

2. **Animal Type**
   - Dropdown with existing types
   - Text input option for new type
   - "+ Add New Type" button to toggle input
   - "Manage Types" button to show/edit/delete existing types
   - Duplicate prevention with normalization

3. **Family**
   - Dropdown with existing families
   - Text input option for new family
   - "+ Add New Family" button to toggle input
   - "Manage Families" button to show/edit/delete existing families
   - Duplicate prevention with normalization

### Type/Family Management:
- **Edit**: Modify existing type/family name
- **Delete**: Remove type/family with confirmation prompt
- **Normalization**: Automatically prevents duplicates (case-insensitive, trimmed)
- **Confirmation**: "Are you sure?" prompts for destructive actions

### Behavior:
- Modal stays open after saving (for quick editing)
- Dropdowns refresh after save
- Updates reflected immediately on dashboard
- Form validation prevents empty required fields

---

## 5. DATA PROCESSING & CALCULATIONS

### Location Filtering:

1. **Isolated Location Filter** (Per Tracker)
   - Removes locations >100km from any other location of the same tracker
   - Removes locations >200km from average center of all locations for that tracker
   - **Note**: Only affects map display, all data remains in database

2. **Timezone Detection**
   - Automatically detects timezone based on location coordinates
   - Saudi Arabia region → Asia/Riyadh (KSA UTC+3)
   - All date/time displays use detected timezone
   - Date filtering uses local timezone dates

### Statistics Calculations:

1. **Total Distance**
   - Sum of distances between consecutive locations
   - Uses Haversine formula for accurate GPS distance
   - Excludes isolated/outlier locations

2. **Average Distance Per Day**
   - Groups locations by calendar day (in detected timezone)
   - Sums distance traveled each day
   - Average = (sum of daily distances) / (number of days with locations)
   - Only counts days with location data

3. **Battery Percentage**
   - Calculated: (current voltage / initial voltage) × 100
   - Uses `initial_battery_voltage` from tracker
   - Displays as percentage and voltage (e.g., "3.30V (100%)")

4. **Avg Update Time**
   - Average of time differences: (current time - last update) for each tracker
   - Only includes valid timestamps (not future dates, not invalid)
   - Format: minutes/hours/days ago

5. **Status Calculation**
   - **Active**: Recent updates + good battery
   - **Inactive**: No recent updates
   - **Alert**: Low battery or other issues

### Data Sources:
- **Primary**: PostgreSQL database via `/api/locations` endpoint
- **Fallback**: CSV file if database unavailable
- Data loaded on page load and refresh

---

## 6. INTERACTIVE FEATURES

### Map Interactions:
- **Click Marker**: Opens popup with location details
- **Click Animal**: Selects animal, zooms to location, shows all popups
- **Zoom Controls**: Mouse wheel, buttons, or gestures
- **Pan**: Click and drag to move map

### Filter Interactions:
- **Real-time Updates**: All filters update map and statistics immediately
- **Combined Filters**: Multiple filters work together (AND logic)
- **Persistent Selection**: Selected trackers persist across filter changes

### Keyboard Shortcuts:
- None currently implemented

---

## 7. TECHNICAL FEATURES

### Data Formatting:
- **Timestamps**: ISO format stored, displayed in local timezone
- **Coordinates**: Decimal degrees (latitude, longitude)
- **Distances**: Kilometers or meters (auto-formatted)
- **Dates**: Local timezone-aware formatting

### Performance Optimizations:
- **Filtered Rendering**: Only renders visible/filtered locations
- **Efficient Queries**: Database queries optimized with indexes
- **Lazy Loading**: Data loaded on demand

### Error Handling:
- Connection errors show user-friendly messages
- Invalid data gracefully skipped
- Console logging for debugging
- Empty states handled (shows "--" or "N/A")

---

## 8. DATA VALIDATION

### Coordinate Validation:
- Latitude: -90 to 90 degrees
- Longitude: -180 to 180 degrees
- Invalid coordinates filtered out

### Timestamp Validation:
- Must be valid ISO date format
- Future dates filtered (beyond 1 minute clock skew)
- Invalid dates excluded from calculations

### Duplicate Prevention:
- Type/Family names normalized (trimmed, lowercase for comparison)
- Prevents duplicate entries in dropdowns
- Case-insensitive duplicate checking

---

## 9. VISUAL DESIGN

### Color Coding:
- Each animal assigned unique color
- Status badges: Green (Active), Red/Pink (Inactive), Orange (Alert)
- Consistent color usage across markers, paths, and UI elements

### Responsive Layout:
- Sidebar: Fixed width (320px)
- Map: Flexible, fills remaining space
- Statistics cards: Responsive grid

### UI Components:
- Collapsible sections (Filters)
- Modal dialogs (Edit Tracker)
- Dropdown menus
- Checkboxes
- Date pickers
- Loading spinners

---

## 10. API INTEGRATION

### Endpoints Used:
1. **GET /api/locations**: Fetch all location data (CSV format)
2. **GET /api/trackers/:slug**: Get tracker details
3. **PUT /api/trackers/:slug**: Update tracker information

### Request/Response:
- CSV parsing on frontend
- JSON for tracker updates
- Error handling with user feedback

---

## 11. USER WORKFLOWS

### Viewing Animal Locations:
1. Dashboard loads → Data fetched from database
2. Filters applied → Map and statistics update
3. Click animal → Map zooms, popups shown
4. Change visualization mode → Map re-renders

### Editing Tracker:
1. Click edit button → Modal opens
2. Modify fields → Changes reflected in form
3. Add new type/family → Dropdown updates
4. Save → API call, dashboard refreshes

### Exporting Data:
1. Apply desired filters
2. Click download CSV button
3. File downloads with current filtered data
4. Filename: `tracker_locations_YYYY-MM-DD.csv`

### Filtering Locations:
1. Expand filters section
2. Select filters (trackers, status, type, family, dates)
3. Choose visualization mode
4. Map and statistics update in real-time

---

## 12. EDGE CASES HANDLED

- Empty database → Shows empty state, no errors
- No locations for tracker → Handled gracefully
- Invalid coordinates → Filtered out
- Future timestamps → Excluded from calculations
- Missing data fields → Shows defaults or "N/A"
- Large datasets → Efficient filtering and rendering
- Network errors → User-friendly error messages
- Browser compatibility → Modern browser support

---

## Summary

The dashboard provides a comprehensive, real-time view of animal tracking data with:
- ✅ Interactive map visualization
- ✅ Multiple filtering options
- ✅ Real-time statistics
- ✅ Tracker editing capabilities
- ✅ Data export functionality
- ✅ Timezone-aware date handling
- ✅ Distance calculations
- ✅ Battery monitoring
- ✅ Status tracking
- ✅ User-friendly interface

All features work together seamlessly to provide a complete animal tracking solution.

