type PlaceResult = {
  formattedAddress?: string | null;
  fetchFields(request: { fields: string[] }): Promise<unknown>;
};

export type PlacePrediction = {
  text: { toString(): string };
  toPlace(): PlaceResult;
};

type PlacesLibrary = {
  AutocompleteSessionToken: new () => object;
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions(request: Record<string, unknown>): Promise<{
      suggestions: Array<{ placePrediction: PlacePrediction | null }>;
    }>;
  };
};

type MapsNamespace = {
  importLibrary?: (name: string, ...rest: unknown[]) => Promise<PlacesLibrary>;
  __ib__?: () => void;
};

let loading: Promise<PlacesLibrary> | null = null;

function mapsNamespace(): MapsNamespace {
  const host = window as Window & { google?: { maps?: MapsNamespace } };
  host.google ??= {};
  host.google.maps ??= {};
  return host.google.maps;
}

// Same bootstrap Google documents for importLibrary, written out so production
// CSP does not need eval. The Maps script is inserted only when this runs.
function installBootstrap(apiKey: string): MapsNamespace {
  const maps = mapsNamespace();
  if (typeof maps.importLibrary === "function") return maps;

  const requested = new Set<string>();
  let scriptPromise: Promise<void> | undefined;

  const bootstrap: NonNullable<MapsNamespace["importLibrary"]> = (library, ...rest) => {
    requested.add(library);
    scriptPromise ??= new Promise<void>((resolve, reject) => {
      const params = new URLSearchParams();
      params.set("libraries", [...requested].join(","));
      params.set("key", apiKey);
      params.set("v", "weekly");
      params.set("callback", "google.maps.__ib__");
      maps.__ib__ = () => {
        delete maps.__ib__;
        resolve();
      };
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
      script.onerror = () => {
        delete maps.importLibrary;
        delete maps.__ib__;
        scriptPromise = undefined;
        reject(new Error("Google Maps failed to load"));
      };
      document.head.append(script);
    });

    return scriptPromise.then(() => {
      const ready = mapsNamespace().importLibrary;
      if (!ready || ready === bootstrap) {
        throw new Error("Google Maps failed to load");
      }
      return ready(library, ...rest);
    });
  };

  maps.importLibrary = bootstrap;
  return maps;
}

export function loadPlacesLibrary(apiKey: string): Promise<PlacesLibrary> {
  if (!apiKey) return Promise.reject(new Error("Missing Google Maps key"));
  if (loading) return loading;

  loading = Promise.resolve()
    .then(() => installBootstrap(apiKey).importLibrary?.("places"))
    .then((library) => {
      if (!library?.AutocompleteSuggestion || !library.AutocompleteSessionToken) {
        throw new Error("Places library is unavailable");
      }
      return library;
    })
    .catch((error: unknown) => {
      loading = null;
      throw error;
    });

  return loading;
}
