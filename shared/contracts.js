export const ROOMS = [
  { id: 'bedroom', name: 'Bedroom' },
  { id: 'living-room', name: 'Living room' },
  { id: 'home-office', name: 'Home office' },
  { id: 'bathroom', name: 'Bathroom' },
];
export const TYPES = { switch: 'On/off', contact: 'Open/closed', levels: 'Sensor levels', watering: 'Plant watering' };
export const FIXED_STATUSES = {
  switch: [{ slug: 'on', label: 'On' }, { slug: 'off', label: 'Off' }],
  contact: [{ slug: 'open', label: 'Open' }, { slug: 'closed', label: 'Closed' }],
  watering: [{ slug: 'watered', label: 'Watered' }],
};
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const slugify = value => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80).replace(/-$/, '');
