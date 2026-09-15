// ─── Constants ───────────────────────────────────────────────────────────────
export const BANKS = [
  "Nepal Bank Limited","Rastriya Banijya Bank","Agriculture Development Bank",
  "Nabil Bank","Nepal Investment Mega Bank","Standard Chartered Bank Nepal",
  "Himalayan Bank","Nepal SBI Bank","Nepal Bangladesh Bank","Everest Bank",
  "Bank of Kathmandu","Century Commercial Bank","Sunrise Bank","NMB Bank",
  "Prabhu Bank","Global IME Bank","Citizens Bank International","Prime Commercial Bank",
  "Sanima Bank","Machhapuchhre Bank","Kumari Bank","Laxmi Sunrise Bank",
  "Civil Bank","Mega Bank Nepal","Siddhartha Bank","Nic Asia Bank",
  "Janata Bank Nepal","Mega Bank","Shangrila Development Bank","Other"
];

export const SALUTATIONS = ["Mr.", "Mrs.", "Ms."];

export const LAND_TYPES = ["Agricultural","Residential","Commercial","Industrial","Forest","River/Water","Road","Other"];
export const LAND_CATEGORIES = ["Aabal","Doyam","Sim","Chahar","Pancham"];
export const OWNERSHIP_TYPES = ["Single","Private","Joint","Government","Guthi","Guthi Raitani","Other"];

// ─── Helpers ─────────────────────────────────────────────────────────────────
export const uid = () => Math.random().toString(36).slice(2, 8);

export const emptyDirector = () => ({
  id: uid(), salutation:"", name:"", citizenshipNo:"", issuedDate:"", issuedBy:"",
  address:"", contact:"", fatherName:"", grandfatherName:"", husbandName:"", fatherInLawName:""
});

export const emptyPerson = () => ({
  salutation:"", name:"", citizenshipNo:"", issuedDate:"", issuedBy:"",
  address:"", contact:"", fatherName:"", grandfatherName:"", husbandName:"", fatherInLawName:""
});

export const emptyCompanyData = () => ({
  name:"", panVat:"", regNo:"", regDate:"", regOn:"", address:"", contact:"", directors:[emptyDirector()]
});

export const emptyClient = () => ({
  id: uid(), showPerson: true, showCompany: false, person: emptyPerson(), company: emptyCompanyData()
});

export const emptyProperty = () => ({
  id: uid(), plotNo:"", traceSheetNo:"", landType:"", addressLalpurja:"", presentAddress:"",
  category:"", areaUnit:"radp", areaSqm:"", areaRadp:{r:"",a:"",p:"",d:""}, areaBkd:{b:"",k:"",d:""},
  ownershipType:"", ownerSalutation:"", ownerName:"", tenantInfo:"",
  location:"", googlePlusCode:"", lat:"", lng:"",
  _mapEnabled: false
});

export const FLOOR_NAMES = [
  "Ground Floor","First Floor","Second Floor","Third Floor","Fourth Floor",
  "Fifth Floor","Sixth Floor","Seventh Floor","Eighth Floor","Ninth Floor","Tenth Floor"
];

export const floorName = (index) => index < FLOOR_NAMES.length ? FLOOR_NAMES[index] : `${index}th Floor`;

export const emptyBuildingArea = (description="") => ({
  id: uid(), description, areaActual:"", areaApproved:"", areaCertificate:""
});

export const emptyBuilding = () => ({
  id: uid(),
  ownerSource:"",       // links to property.id (auto-fills owner & plot)
  ownerName:"", plotNo:"",
  faceDirection:"", numFloors:"", floorPermission:"",
  yearOfConstruction:"", expectedLife:"60", completionDate:"", ageOfBuilding:"",
  structureType:"", foundationType:"",
  areaTable: [emptyBuildingArea("Up to Plinth Level"), emptyBuildingArea(floorName(0))]
});

export const FACE_DIRECTIONS = ["East","West","North","South","North-East","North-West","South-East","South-West"];
export const STRUCTURE_TYPES = ["RCC Framed","Load Bearing Brick","Load Bearing Stone","Steel Framed","Wood Framed","Mud/Adobe","Other"];
export const FOUNDATION_TYPES = ["Isolated Footing","Combined Footing","Raft","Strip","Pile","Stone","Mud","Other"];
