const STATE_TAIL = /[,]?[ ]*(?:VIC|Vic|Victoria)[ ]*[0-9]{4}[ ]*(?:[,]?[ ]*Australia)?[ ]*$/;

export function shortAddress(address: string): string {
  return address.replace(STATE_TAIL, "").replace(/,/g, "").replace(/\s+/g, " ").trim();
}

export function mapsHref(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`;
}
