Folder: services
Purpose: API integrations and auth services used by the web client.

Police module notes:

- `policeService.js` is the single web client integration layer for `/api/police/*`.
- Police pages now load real dashboard, incident, alert, history, work-zone, and location data from the backend instead of `policeMockData`.
- Work-zone setup is enforced through the police access gate so first-login officers must choose Wilaya then Commune before entering the rest of police mode.
