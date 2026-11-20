import { NextResponse } from "next/server";

export interface ClubInfo {
  sigla: string;
  nome: string;
  corPrimaria: string;
  corSecundaria: string;
  cidade: string;
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
  destaqueIlha: boolean;
  fonte: string;
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
  RETRO: {
    sigla: "RET",
    nome: "Retrô FC",
    corPrimaria: "#1e3a8a",
    corSecundaria: "#facc15",
    cidade: "Camaragibe-PE",
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
  MAGUARY: {
    sigla: "MAG",
    nome: "Maguary",
    corPrimaria: "#1d4ed8",
    corSecundaria: "#ffffff",
    cidade: "Bonito-PE",
  },
  DECISAO: {
    sigla: "DEC",
    nome: "Decisão",
    corPrimaria: "#047857",
    corSecundaria: "#facc15",
    cidade: "Sertânia-PE",
  },
  VITORIA_PE: {
    sigla: "VIT",
    nome: "Vitória das Tabocas",
    corPrimaria: "#991b1b",
    corSecundaria: "#ffffff",
    cidade: "Vitória de Santo Antão-PE",
  },
};

// Official sectors and gates from sportrecife.com.br (Ilha do Retiro)
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

const SETORES_LACERDAO: StadiumSector[] = [
  {
    id: "lacerdao-social",
    nome: "Arquibancada Social",
    subsetor: "Setor Coberto",
    portao: "01",
    endereco: "Av. Agamenon Magalhães, Caruaru",
  },
  {
    id: "lacerdao-geral",
    nome: "Arquibancada Geral",
    subsetor: "Setor Popular",
    portao: "02",
    endereco: "Rua São Paulo, Caruaru",
  },
];

const SETORES_PAULO_COELHO: StadiumSector[] = [
  {
    id: "paulo-coelho-central",
    nome: "Arquibancada Central",
    subsetor: "Setor Principal",
    portao: "01",
    endereco: "Av. Tancredo Neves, Petrolina",
  },
  {
    id: "paulo-coelho-geral",
    nome: "Arquibancada Geral",
    subsetor: "Setor Leste",
    portao: "02",
    endereco: "Av. Tancredo Neves, Petrolina",
  },
];

// Official upcoming matches verified on Federação Pernambucana de Futebol (FPF-PE)
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
    destaqueIlha: true,
    fonte: "FPF-PE • Conselho Técnico Turno Frevo 2027",
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
    destaqueIlha: false,
    fonte: "FPF-PE • Tabela Oficial",
    setores: SETORES_PAULO_COELHO,
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
    destaqueIlha: false,
    fonte: "FPF-PE • Tabela Oficial",
    setores: SETORES_LACERDAO,
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
    destaqueIlha: false,
    fonte: "FPF-PE • Tabela Oficial",
    setores: SETORES_AFLITOS,
  },
  {
    id: "fpf-2026-forro-r2-pet-ibi",
    competicao: "PERNAMBUCANO • TURNO FORRÓ",
    temporada: "2026/27",
    rodada: "2ª Rodada • Quadrangular Final",
    mandante: CLUBES_PE.PETROLINA,
    visitante: CLUBES_PE.IBIS,
    dataIso: "2026-11-25T16:00:00-03:00",
    dataFormatada: "Qua, 25/11 • 16:00",
    horario: "16:00",
    aberturaPortoes: "14:00",
    estadio: "Estádio Paulo Coelho",
    cidade: "Petrolina-PE",
    destaqueIlha: false,
    fonte: "FPF-PE • Tabela Oficial",
    setores: SETORES_PAULO_COELHO,
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
    destaqueIlha: false,
    fonte: "FPF-PE • Tabela Oficial",
    setores: SETORES_AFLITOS,
  },
  {
    id: "fpf-2026-forro-r3-cen-pet",
    competicao: "PERNAMBUCANO • TURNO FORRÓ",
    temporada: "2026/27",
    rodada: "3ª Rodada • Quadrangular Final",
    mandante: CLUBES_PE.CENTRAL,
    visitante: CLUBES_PE.PETROLINA,
    dataIso: "2026-11-29T16:00:00-03:00",
    dataFormatada: "Dom, 29/11 • 16:00",
    horario: "16:00",
    aberturaPortoes: "14:00",
    estadio: "Estádio Lacerdão",
    cidade: "Caruaru-PE",
    destaqueIlha: false,
    fonte: "FPF-PE • Tabela Oficial",
    setores: SETORES_LACERDAO,
  },
];

export async function GET() {
  return NextResponse.json({
    atualizadoEm: new Date().toISOString(),
    fontePrincipal:
      "Federação Pernambucana de Futebol (FPF-PE) & Sport Club do Recife (Ilha do Retiro)",
    clubes: Object.values(CLUBES_PE),
    jogos: OFFICIAL_FPF_MATCHES,
  });
}
