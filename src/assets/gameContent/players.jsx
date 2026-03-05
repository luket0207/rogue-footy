const NATIONALITY_POOLS = Object.freeze([
  Object.freeze({
    country: "UK",
    firstNames: Object.freeze(["Oliver", "Aaron", "Connor", "Ryan", "Marcus", "Ben", "Tyler", "Noah"]),
    lastNames: Object.freeze(["Kane", "Price", "Blake", "Shaw", "Patel", "Boyd", "Carter", "Grant"]),
  }),
  Object.freeze({
    country: "Spain",
    firstNames: Object.freeze(["Diego", "Marco", "Hugo", "Julian", "Lucas", "Mateo", "Elias", "Adrian"]),
    lastNames: Object.freeze(["Alvarez", "Silva", "Marin", "Costa", "Meyer", "Rossi", "Vega", "Navarro"]),
  }),
  Object.freeze({
    country: "Brazil",
    firstNames: Object.freeze(["Thiago", "Rafael", "Bruno", "Caio", "Vinicius", "Joao", "Danilo", "Pedro"]),
    lastNames: Object.freeze(["Santos", "Oliveira", "Pereira", "Costa", "Souza", "Nunes", "Lima", "Duarte"]),
  }),
  Object.freeze({
    country: "Germany",
    firstNames: Object.freeze(["Lukas", "Jonas", "Felix", "Nico", "Maxim", "Leon", "Florian", "Timo"]),
    lastNames: Object.freeze(["Novak", "Schneider", "Meyer", "Fischer", "Keller", "Becker", "Hoffmann", "Weber"]),
  }),
  Object.freeze({
    country: "France",
    firstNames: Object.freeze(["Leo", "Theo", "Mathis", "Jules", "Antoine", "Adrien", "Yanis", "Hugo"]),
    lastNames: Object.freeze(["Dubois", "Moreau", "Lefevre", "Garcia", "Martin", "Petit", "Lambert", "Mercier"]),
  }),
  Object.freeze({
    country: "Italy",
    firstNames: Object.freeze(["Lorenzo", "Matteo", "Alessio", "Marco", "Giulio", "Nicolo", "Enzo", "Davide"]),
    lastNames: Object.freeze(["Rossi", "Bianchi", "Esposito", "Romano", "Conti", "Gallo", "Fontana", "Rinaldi"]),
  }),
  Object.freeze({
    country: "Argentina",
    firstNames: Object.freeze(["Tomas", "Franco", "Luciano", "Santiago", "Emiliano", "Facundo", "Nicolas", "Agustin"]),
    lastNames: Object.freeze(["Lopez", "Fernandez", "Gomez", "Diaz", "Paz", "Acosta", "Romero", "Molina"]),
  }),
  Object.freeze({
    country: "Japan",
    firstNames: Object.freeze(["Haruto", "Ren", "Yuto", "Sota", "Kaito", "Ryota", "Daiki", "Shun"]),
    lastNames: Object.freeze(["Tanaka", "Sato", "Suzuki", "Takahashi", "Kobayashi", "Watanabe", "Ito", "Yamada"]),
  }),
]);

const PLAYER_IDENTITY_POOLS = Object.freeze({
  age: Object.freeze({
    min: 20,
    max: 26,
  }),
  appearanceRange: Object.freeze({
    min: 1,
    max: 5,
  }),
  nationalities: NATIONALITY_POOLS,
});

export { NATIONALITY_POOLS };
export default PLAYER_IDENTITY_POOLS;

