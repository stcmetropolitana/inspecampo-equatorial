/**
 * ==========================================================================
 * DADOS DE DEMONSTRAÇÃO — Usuários e Checklists
 * ==========================================================================
 * A partir desta versão, o cadastro de equipes (prefixo, veículo, etc.) é
 * feito manualmente pelo fiscal em campo — não existe mais uma lista fixa
 * de 128 equipes pré-cadastradas. O que continua sendo semeado aqui é a
 * lista de USUÁRIOS (Administrador, Líderes e Fiscais).
 * ==========================================================================
 */

const SENHA_PADRAO = "1234";

/**
 * LÍDERES
 * ------------------------------------------------------------------------
 * Cada líder enxerga, no "Painel do Líder", todos os cadastros e inspeções
 * realizados pelos fiscais vinculados a ele (campo liderId, abaixo).
 * ------------------------------------------------------------------------
 */
const LIDERES = [
  { id: "L01", nome: "Caique Kauan Mendes Ventura",  matricula: "21030567" },
  { id: "L02", nome: "Adailton da Silva Oliveira",   matricula: "21030192" },
  { id: "L03", nome: "Lorena Ribeiro de Almeida",    matricula: "21054560" }
];

/**
 * USUÁRIOS (Administrador + Analistas + Fiscais)
 * ------------------------------------------------------------------------
 * Edite aqui os dados de cada pessoa: nome, matrícula, senha, perfil
 * ("admin", "analista" ou "fiscal") e o líder ao qual ela está vinculada
 * (liderId — use o "id" definido em LIDERES acima). O usuário com perfil
 * "admin" não precisa de liderId.
 *
 * Os analistas e fiscais abaixo foram cadastrados SEM líder vinculado
 * (liderId: null) de propósito — o Administrador faz essa vinculação
 * pela tela "Usuários" (js/usuarios.js), depois do primeiro acesso.
 *
 * O "analista" é vinculado a um líder (igual o fiscal) e é responsável por
 * enviar Ordens de Inspeção de Ativo para os fiscais daquele líder e
 * acompanhar a conclusão. O líder e o administrador enxergam todas as
 * ordens da equipe (enviadas pelo líder ou por qualquer analista dele).
 * ------------------------------------------------------------------------
 */
const USUARIOS = [
  { nome: "Nilton Junior Santos Sousa", matricula: "21030190", senha: "Maio2021", perfil: "admin" },
  { nome: "Cassia Helena Do Carmo Gontigo Silva", matricula: "21025407", senha: "admin2026", perfil: "admin" },

  { nome: "Alessandro Pereira Bispo",              matricula: "21056985", perfil: "analista", liderId: null },
  { nome: "Lucas Rodrigues de Sousa Guimaraes",     matricula: "21058009", perfil: "analista", liderId: null },
  { nome: "Nathalia Melo de Oliveira",              matricula: "21057893", perfil: "analista", liderId: null },
  { nome: "Silvana de Araujo Santos Oliveira",      matricula: "21023893", perfil: "analista", liderId: null },
  { nome: "Tatiane da Costa Sousa",                 matricula: "21056883", perfil: "analista", liderId: null },

  { nome: "Cassio Rodrigues de Andrade",            matricula: "21030803", perfil: "fiscal", liderId: null },
  { nome: "Diogo Correia da Silva",                 matricula: "21030198", perfil: "fiscal", liderId: null },
  { nome: "Joao Gabriel Martins Lourenco",          matricula: "21057493", perfil: "fiscal", liderId: null },
  { nome: "Carlos Helio Jose Pereira",              matricula: "21030196", perfil: "fiscal", liderId: null },
  { nome: "Henrique Lemes do Prado",                matricula: "21030664", perfil: "fiscal", liderId: null },
  { nome: "Ivan Soares Lima",                       matricula: "21057517", perfil: "fiscal", liderId: null },
  { nome: "Jorgeval Martins Godinho",                matricula: "21056595", perfil: "fiscal", liderId: null },
  { nome: "Fabricio Fideles de Oliveira",           matricula: "21056821", perfil: "fiscal", liderId: null },
  { nome: "Luis Guimaraes da Silva Filho",          matricula: "21030551", perfil: "fiscal", liderId: null },
  { nome: "Rafael Pereira de Almeida",              matricula: "21056870", perfil: "fiscal", liderId: null },
  { nome: "Ronevon Divino Bernardo de Barros",      matricula: "21030688", perfil: "fiscal", liderId: null },
  { nome: "Ronaldo Mendes Cavalcante",              matricula: "21055613", perfil: "fiscal", liderId: null },
  { nome: "Saul Moreira Goncalves Neto",            matricula: "21030666", perfil: "fiscal", liderId: null }
];

function slugEmail(nome) {
  return nome.toLowerCase().replace(/\s+/g, ".").normalize("NFD").replace(/[\u0300-\u036f]/g, "") + "@equatorial.com.br";
}

function buildFiscais() {
  const usuarios = USUARIOS.map((u, i) => ({
    id: `F${String(i + 1).padStart(2, "0")}`,
    nome: u.nome,
    matricula: u.matricula || `EQT${(20000 + i * 137).toString()}`,
    senha: u.senha || SENHA_PADRAO,
    perfil: u.perfil || "fiscal",
    liderId: u.liderId || null,
    email: slugEmail(u.nome)
  }));
  const lideres = LIDERES.map(l => ({
    id: l.id,
    nome: l.nome,
    matricula: l.matricula,
    senha: l.senha || SENHA_PADRAO,
    perfil: "lider",
    liderId: null,
    email: slugEmail(l.nome)
  }));
  return [...usuarios, ...lideres];
}

/**
 * CHECKLIST DE EPIs — verificado individualmente para cada eletricista da equipe
 */
const EPI_ITEMS = [
  "CAMISA (VESTIMENTA FR)",
  "CALÇA (VESTIMENTA FR)",
  "CAPACETE CLASSE B",
  "ÓCULOS DE PROTEÇÃO",
  "CALÇADO DE SEGURANÇA – COM CADARÇO",
  "LUVAS DE VAQUETA",
  "LUVAS DE BORRACHA CLASSE 0",
  "LUVAS DE BORRACHA CLASSE 2",
  "BALACLAVA INERENTE",
  "MANGA ISOLANTE DE BORRACHA CLASSE 2",
  "CINTO DE SEGURANÇA TIPO PARAQUEDISTA – ALTURA E ESPAÇO CONFINADO",
  "TALABARTE DE POSICIONAMENTO",
  "BALDE PARA IÇAMENTO DE MATERIAL",
  "TRAVA QUEDAS COM ABSORVEDOR",
  "PERNEIRA COM VELCRO E PRESILHA",
  "BOLSA PARA CAPACETE",
  "BOLSA PARA TRANSPORTE DE EPI",
  "BOLSA PARA LUVA ISOLANTE",
  "BOLSA PARA MANGA ISOLANTE",
  "PROTETOR FACIAL CONTRA ARCO ELÉTRICO"
];

/**
 * CHECKLIST DE EPCs — verificado uma única vez por veículo/equipe
 */
const EPC_ITEMS = [
  "CONES DE SINALIZAÇÃO COM FAIXA REFLETIVA",
  "VARA DE MANOBRA TELESCÓPICA DE 7 ELEMENTOS",
  "VARA DE MANOBRA SECCIONÁVEL DE 5 ELEMENTOS",
  "ALICATE AMPERÍMETRO",
  "ATERRAMENTOS DE 5 GRAMPOS",
  "CONJUNTO DE ATERRAMENTO TEMPORÁRIO 36 KV",
  "CONJUNTO DE ATERRAMENTO TEMPORÁRIO PARA REDE MULTIPLEXADAS",
  "KIT PARA TRABALHO E RESGATE EM ALTURA",
  "CORDA PARA AMARRAÇÃO DE ESCADA",
  "TALABARTE TIPO I (SE FOR CESTO)",
  "BASTÃO DE MANOBRA (PEGA TUDO) – 35 KV",
  "CONJUNTO DE ATERRAMENTO TEMPORÁRIO PARA VEÍCULO (SE FOR CESTO)",
  "ESCADA EXTENSÍVEL",
  "ESCADA SIMPLES",
  "FITA RETRÁTIL PARA SINALIZAÇÃO",
  "BANDEIROLA DE SINALIZAÇÃO",
  "PLACA SINALIZAÇÃO - HOMENS TRABALHANDO",
  "DISPOSITIVO DE ABERTURA DE CARGA (ATÉ 27 KV)",
  "DISPOSITIVO DE ABERTURA DE CARGA (ATÉ 34,5 KV)",
  "DISPOSITIVO ANTI QUEDA - DAQC",
  "DISPOSITIVO DE ÂNCORAGEM TIPO AGULHÃO",
  "DETECTOR DE TENSÃO POR APROXIMAÇÃO (110 V A 40 KV)",
  "MACACÃO TIPO APICULTOR",
  "LENÇOL ISOLANTE"
];

function seedDemoData() {
  DB.init(buildFiscais());
}
