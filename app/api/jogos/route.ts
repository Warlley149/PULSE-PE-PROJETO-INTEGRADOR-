import { NextResponse } from "next/server";

export interface ClubInfo {
  sigla: string;
  nome: string;
  corPrimaria: string;
  corSecundaria: string;
  cidade: string;
  logoUrl?: string;
}

export interface StadiumSector {
  id: string;
  nome: string;
  subsetor: string;
  portao: string;
  endereco: string;
}

export interface OfficialMatch {
  id: string;
  competicao: string;
  temporada: string;
  rodada: string;
  mandante: ClubInfo;
  visitante: ClubInfo;
  dataIso: string;
  dataFormatada: string;
  horario: string;
  aberturaPortoes: string;
  estadio: string;
  cidade: string;
  regiao: "pe" | "brasil";
  destaqueIlha: boolean;
  fonte: string;
  aoVivoApi: boolean;
  setores: StadiumSector[];
}

export const CLUBES_PE: Record<string, ClubInfo> = {
  SPORT: {
    sigla: "SPO",
    nome: "Sport Recife",
    corPrimaria: "#c8102e",
    corSecundaria: "#1a1a1a",
    cidade: "Recife-PE",
  },
  NAUTICO: {
    sigla: "NAU",
    nome: "Náutico",
    corPrimaria: "#d91c24",
    corSecundaria: "#ffffff",
    cidade: "Recife-PE",
  },
  SANTA_CRUZ: {
    sigla: "STA",
    nome: "Santa Cruz",
    corPrimaria: "#111111",
    corSecundaria: "#e11d48",
    cidade: "Recife-PE",
  },
  CENTRAL: {
    sigla: "CEN",
    nome: "Central",
    corPrimaria: "#111111",
    corSecundaria: "#ffffff",
    cidade: "Caruaru-PE",
  },
  AMERICA_PE: {
    sigla: "AME",
    nome: "América-PE",
    corPrimaria: "#15803d",
    corSecundaria: "#ffffff",
    cidade: "Recife-PE",
  },
  PETROLINA: {
    sigla: "PET",
    nome: "Petrolina",
    corPrimaria: "#b91c1c",
    corSecundaria: "#facc15",
    cidade: "Petrolina-PE",
  },
  IBIS: {
    sigla: "IBI",
    nome: "Íbis",
    corPrimaria: "#dc2626",
    corSecundaria: "#111111",
    cidade: "Paulista-PE",
  },
};

export const SETORES_ILHA_DO_RETIRO: StadiumSector[] = [
  {
    id: "cadeiras-centrais",
    nome: "Cadeiras Centrais",
    subsetor: "Setor Central • Portaria Principal",
    portao: "02",
    endereco: "Rua Sport Club do Recife",
  },
  {
    id: "sociais",
    nome: "Sociais",
    subsetor: "Sociais Dona Maria • Portaria Principal",
    portao: "03",
    endereco: "Rua Sport Club do Recife",
  },
  {
    id: "assento-especial",
    nome: "Assento Especial",
    subsetor: "Portaria Principal",
    portao: "04",
    endereco: "Rua Sport Club do Recife",
  },
  {
    id: "arquibancada-sede",
    nome: "Arquibancada da Sede",
    subsetor: "Setor Sede Central",
    portao: "05",
    endereco: "Rua Abdias de Carvalho",
  },
  {
    id: "arquibancada-frontal",
    nome: "Arquibancada Frontal",
    subsetor: "Portaria do Arco",
    portao: "06",
    endereco: "Av. Prefeito Lima Castro",
  },
  {
    id: "cadeiras-ampliacao",
    nome: "Cadeiras de Ampliação",
    subsetor: "Portaria Principal",
    portao: "11",
    endereco: "Rua Sport Club do Recife",
  },
  {
    id: "camarotes",
    nome: "Camarotes",
    subsetor: "Acesso Exclusivo Principal",
    portao: "01",
    endereco: "Rua Sport Club do Recife",
  },
  {
    id: "arquibancada-placar",
    nome: "Arquibancada Placar (Visitante)",
    subsetor: "Acesso Visitante",
    portao: "10",
    endereco: "Rua Hisbelo Campos",
  },
];

const SETORES_AFLITOS: StadiumSector[] = [
  {
    id: "aflitos-central",
    nome: "Cadeiras Centrais",
    subsetor: "Setor Vermelho • Sede",
    portao: "01",
    endereco: "Av. Conselheiro Rosa e Silva",
  },
  {
    id: "aflitos-hexacampeao",
    nome: "Arquibancada Hexa",
    subsetor: "Setor Caldeirão",
    portao: "03",
    endereco: "Rua Manuel de Carvalho",
  },
  {
    id: "aflitos-visitante",
    nome: "Setor Visitante",
    subsetor: "Arquibancada Visitante",
    portao: "05",
    endereco: "Rua Angustura",
  },
];

const SETORES_ARENA_PADRAO = (estadio: string): StadiumSector[] => [
  {
    id: "setor-norte",
    nome: "Arquibancada Norte",
    subsetor: "Setor Popular • Acesso Facial",
    portao: "01",
    endereco: `Portão Norte • ${estadio}`,
  },
  {
    id: "setor-leste",
    nome: "Cadeira Leste Central",
    subsetor: "Anel Inferior Central",
    portao: "02",
    endereco: `Portão Principal • ${estadio}`,
  },
  {
    id: "setor-oeste",
    nome: "Cadeira Oeste Premium",
    subsetor: "Setor Coberto",
    portao: "04",
    endereco: `Portão Oeste • ${estadio}`,
  },
  {
    id: "setor-sul-visitante",
    nome: "Setor Sul (Visitante)",
    subsetor: "Acesso Exclusivo Visitante",
    portao: "08",
    endereco: `Portão Visitante • ${estadio}`,
  },
];

const OFFICIAL_FPF_MATCHES: OfficialMatch[] = [
  {
    id: "fpf-2027-frevo-sport-estreia",
    competicao: "CAMPEONATO PERNAMBUCANO",
    temporada: "2027",
    rodada: "1ª Rodada • Turno Frevo (Abertura Oficial FPF-PE)",
    mandante: CLUBES_PE.SPORT,
    visitante: CLUBES_PE.NAUTICO,
    dataIso: "2027-01-03T16:00:00-03:00",
    dataFormatada: "03/Jan/2027, 16:00",
    horario: "16:00",
    aberturaPortoes: "14:00",
    estadio: "Ilha do Retiro",
    cidade: "Recife-PE",
    regiao: "pe",
    destaqueIlha: true,
    fonte: "FPF-PE • Oficial",
    aoVivoApi: false,
    setores: SETORES_ILHA_DO_RETIRO,
  },
  {
    id: "fpf-2026-forro-r1-pet-ame",
    competicao: "PERNAMBUCANO • TURNO FORRÓ",
    temporada: "2026/27",
    rodada: "1ª Rodada • Quadrangular Final",
    mandante: CLUBES_PE.PETROLINA,
    visitante: CLUBES_PE.AMERICA_PE,
    dataIso: "2026-11-21T16:00:00-03:00",
    dataFormatada: "Sáb, 21/11 • 16:00",
    horario: "16:00",
    aberturaPortoes: "14:00",
    estadio: "Estádio Paulo Coelho",
    cidade: "Petrolina-PE",
    regiao: "pe",
    destaqueIlha: false,
    fonte: "FPF-PE • Oficial",
    aoVivoApi: false,
    setores: SETORES_ARENA_PADRAO("Estádio Paulo Coelho"),
  },
  {
    id: "fpf-2026-forro-r1-cen-ibi",
    competicao: "PERNAMBUCANO • TURNO FORRÓ",
    temporada: "2026/27",
    rodada: "1ª Rodada • Quadrangular Final",
    mandante: CLUBES_PE.CENTRAL,
    visitante: CLUBES_PE.IBIS,
    dataIso: "2026-11-21T17:00:00-03:00",
    dataFormatada: "Sáb, 21/11 • 17:00",
    horario: "17:00",
    aberturaPortoes: "15:00",
    estadio: "Estádio Lacerdão",
    cidade: "Caruaru-PE",
    regiao: "pe",
    destaqueIlha: false,
    fonte: "FPF-PE • Oficial",
    aoVivoApi: false,
    setores: SETORES_ARENA_PADRAO("Estádio Lacerdão"),
  },
  {
    id: "fpf-2026-forro-r2-ame-cen",
    competicao: "PERNAMBUCANO • TURNO FORRÓ",
    temporada: "2026/27",
    rodada: "2ª Rodada • Quadrangular Final",
    mandante: CLUBES_PE.AMERICA_PE,
    visitante: CLUBES_PE.CENTRAL,
    dataIso: "2026-11-25T16:00:00-03:00",
    dataFormatada: "Qua, 25/11 • 16:00",
    horario: "16:00",
    aberturaPortoes: "14:00",
    estadio: "Estádio dos Aflitos",
    cidade: "Recife-PE",
    regiao: "pe",
    destaqueIlha: false,
    fonte: "FPF-PE • Oficial",
    aoVivoApi: false,
    setores: SETORES_AFLITOS,
  },
  {
    id: "fpf-2026-forro-r3-ibi-ame",
    competicao: "PERNAMBUCANO • TURNO FORRÓ",
    temporada: "2026/27",
    rodada: "3ª Rodada • Quadrangular Final",
    mandante: CLUBES_PE.IBIS,
    visitante: CLUBES_PE.AMERICA_PE,
    dataIso: "2026-11-29T16:00:00-03:00",
    dataFormatada: "Dom, 29/11 • 16:00",
    horario: "16:00",
    aberturaPortoes: "14:00",
    estadio: "Estádio dos Aflitos",
    cidade: "Recife-PE",
    regiao: "pe",
    destaqueIlha: false,
    fonte: "FPF-PE • Oficial",
    aoVivoApi: false,
    setores: SETORES_AFLITOS,
  },
];

interface EspnCompetitor {
  homeAway?: "home" | "away";
  team?: {
    displayName?: string;
    shortDisplayName?: string;
    abbreviation?: string;
    color?: string;
    alternateColor?: string;
    logo?: string;
  };
}

interface EspnEvent {
  id?: string;
  date?: string;
  season?: { year?: number };
  competitions?: Array<{
    venue?: {
      fullName?: string;
      address?: { city?: string; country?: string };
    };
    competitors?: EspnCompetitor[];
  }>;
}

const ESPN_LEAGUES = [
  { slug: "bra.1", label: "BRASILEIRÃO SÉRIE A" },
  { slug: "bra.2", label: "BRASILEIRÃO SÉRIE B" },
  { slug: "conmebol.libertadores", label: "COPA LIBERTADORES" },
  { slug: "conmebol.sudamericana", label: "COPA SUL-AMERICANA" },
];

function formatBrazilDateTime(iso: string): {
  dataFormatada: string;
  horario: string;
  aberturaPortoes: string;
} {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) {
    return { dataFormatada: "Em breve", horario: "—", aberturaPortoes: "—" };
  }

  const dataFormatada = dt.toLocaleString("pt-BR", {
    timeZone: "America/Recife",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const horario = dt.toLocaleTimeString("pt-BR", {
    timeZone: "America/Recife",
    hour: "2-digit",
    minute: "2-digit",
  });

  const openDt = new Date(dt.getTime() - 2 * 60 * 60 * 1000);
  const aberturaPortoes = openDt.toLocaleTimeString("pt-BR", {
    timeZone: "America/Recife",
    hour: "2-digit",
    minute: "2-digit",
  });

  return { dataFormatada, horario, aberturaPortoes };
}

async function fetchEspnLiveMatches(): Promise<OfficialMatch[]> {
  const results: OfficialMatch[] = [];

  await Promise.all(
    ESPN_LEAGUES.map(async (league) => {
      try {
        const res = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.slug}/scoreboard?lang=pt`,
          { next: { revalidate: 300 } },
        );
        if (!res.ok) return;
        const json = (await res.json()) as { events?: EspnEvent[] };
        const events = Array.isArray(json.events) ? json.events : [];

        for (const ev of events) {
          const comp = ev.competitions?.[0];
          const competitors = comp?.competitors || [];
          const home = competitors.find((c) => c.homeAway === "home");
          const away = competitors.find((c) => c.homeAway === "away");
          if (!home?.team || !away?.team || !ev.date) continue;

          const estadio = comp?.venue?.fullName || "Arena Oficial";
          const cidade = comp?.venue?.address?.city || "Brasil";
          const isIlha = estadio.toLowerCase().includes("ilha do retiro");
          const isPe =
            isIlha ||
            cidade.toLowerCase().includes("recife") ||
            estadio.toLowerCase().includes("aflitos") ||
            estadio.toLowerCase().includes("arruda");

          const { dataFormatada, horario, aberturaPortoes } =
            formatBrazilDateTime(ev.date);

          results.push({
            id: `espn-${league.slug}-${ev.id}`,
            competicao: league.label,
            temporada: String(
              ev.season?.year || new Date(ev.date).getFullYear(),
            ),
            rodada: "Calendário Oficial • Atualização Automática ESPN",
            mandante: {
              sigla: (home.team.abbreviation || "MAN").slice(0, 3),
              nome:
                home.team.shortDisplayName ||
                home.team.displayName ||
                "Mandante",
              corPrimaria: home.team.color ? `#${home.team.color}` : "#016294",
              corSecundaria: home.team.alternateColor
                ? `#${home.team.alternateColor}`
                : "#ffffff",
              cidade,
              logoUrl: home.team.logo,
            },
            visitante: {
              sigla: (away.team.abbreviation || "VIS").slice(0, 3),
              nome:
                away.team.shortDisplayName ||
                away.team.displayName ||
                "Visitante",
              corPrimaria: away.team.color ? `#${away.team.color}` : "#4e5462",
              corSecundaria: away.team.alternateColor
                ? `#${away.team.alternateColor}`
                : "#ffffff",
              cidade: "Brasil",
              logoUrl: away.team.logo,
            },
            dataIso: ev.date,
            dataFormatada,
            horario,
            aberturaPortoes,
            estadio,
            cidade,
            regiao: isPe ? "pe" : "brasil",
            destaqueIlha: isIlha,
            fonte: "ESPN Brasil • Tempo Real",
            aoVivoApi: true,
            setores: isIlha
              ? SETORES_ILHA_DO_RETIRO
              : SETORES_ARENA_PADRAO(estadio),
          });
        }
      } catch {
        // Skip failing league gracefully
      }
    }),
  );

  return results;
}

let cachedMatchesPayload: {
  expiresAt: number;
  payload: {
    atualizadoEm: string;
    fontePrincipal: string;
    totalAoVivoEspn: number;
    jogos: OfficialMatch[];
  };
} | null = null;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.has("_t");

  if (
    !forceRefresh &&
    cachedMatchesPayload &&
    Date.now() < cachedMatchesPayload.expiresAt
  ) {
    return NextResponse.json(cachedMatchesPayload.payload, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  }

  const liveEspnMatches = await fetchEspnLiveMatches();
  const allMatches = [...liveEspnMatches, ...OFFICIAL_FPF_MATCHES].sort(
    (a, b) => new Date(a.dataIso).getTime() - new Date(b.dataIso).getTime(),
  );

  const payload = {
    atualizadoEm: new Date().toISOString(),
    fontePrincipal:
      "ESPN Brasil (API Ao Vivo — Série A, Série B, Libertadores, Sul-Americana) & FPF-PE (Ilha do Retiro / Pernambuco)",
    totalAoVivoEspn: liveEspnMatches.length,
    jogos: allMatches,
  };

  cachedMatchesPayload = {
    expiresAt: Date.now() + 5 * 60 * 1000,
    payload,
  };

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
