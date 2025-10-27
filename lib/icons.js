export function iconFor(type) {
  if (type === 'Bedrijf')  return '<i class="fa-solid fa-building"></i>';
  if (type === 'Voertuig') return '<i class="fa-solid fa-car-side"></i>';
  if (type === 'Werf')     return '<i class="fa-solid fa-person-digging"></i>';
  if (type === 'Huis')     return '<i class="fa-solid fa-house"></i>';
  return '<i class="fa-regular fa-clock"></i>';
}
