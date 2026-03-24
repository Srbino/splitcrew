const en = {
  // ── Common ──
  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    close: 'Close',
    confirm: 'Confirm',
    back: 'Back',
    loading: 'Loading...',
    noData: 'No data yet',
    search: 'Search',
    filter: 'Filter',
    all: 'All',
    yes: 'Yes',
    no: 'No',
    or: 'or',
    and: 'and',
    required: 'Required',
    optional: 'Optional',
    actions: 'Actions',
    created: 'Created',
    updated: 'Updated',
    deleted: 'Deleted',
  },

  // ── Auth ──
  auth: {
    signIn: 'Sign in',
    signInAsAdmin: 'Sign in as admin',
    signingIn: 'Signing in...',
    logout: 'Log out',
    crew: 'Crew',
    admin: 'Admin',
    selectName: 'Select your name',
    selectPlaceholder: '– select –',
    crewPassword: 'Crew password',
    adminPassword: 'Admin password',
    enterSharedPassword: 'Enter shared password',
    enterAdminPassword: 'Enter admin password',
    rememberMe: 'Remember me for 7 days',
    noUsersYet: 'No crew members have been added yet.',
    loginAsAdminFirst: 'Log in as admin and add users.',
    incorrectPassword: 'Incorrect password.',
    incorrectAdminPassword: 'Incorrect admin password.',
    selectYourName: 'Select your name.',
    tooManyAttempts: 'Too many attempts. Try again in {{minutes}} min.',
    sessionExpired: 'Session expired. Please refresh the page.',
    connectionError: 'Connection error',
  },

  // ── Navigation ──
  nav: {
    home: 'Home',
    itinerary: 'Itinerary',
    crews: 'Crews',
    shopping: 'Shopping',
    menuPlan: 'Menu Plan',
    wallet: 'Wallet',
    checklist: 'Checklist',
    logbook: 'Logbook',
    cars: 'Cars',
    admin: 'Admin',
    more: 'More',
    darkMode: 'Dark mode',
    lightMode: 'Light mode',
  },

  // ── Dashboard ──
  dashboard: {
    yourBalance: 'Your Balance',
    tripStats: 'Trip Stats',
    totalExpenses: 'Total expenses',
    crew: 'crew',
    daysToGo: '{{days}} days to go',
    startsToday: 'Trip starts today!',
    underway: 'Trip is underway!',
    paid: 'Paid',
    owes: 'Owes',
  },

  // ── Wallet ──
  wallet: {
    title: 'Wallet',
    addExpense: 'Add Expense',
    editExpense: 'Edit Expense',
    amount: 'Amount',
    currency: 'Currency',
    description: 'Description',
    category: 'Category',
    date: 'Date',
    paidBy: 'Paid by',
    splitBetween: 'Split between',
    splitType: 'Split type',
    bothBoats: 'Both boats',
    boat1Only: 'Boat 1 only',
    boat2Only: 'Boat 2 only',
    balances: 'Balances',
    settlements: 'Settlements',
    expenses: 'Expenses',
    auditLog: 'Audit Log',
    noExpenses: 'No expenses yet',
    totalSpent: 'Total spent',
    exchangeRate: 'Exchange rate',
    equivalentIn: 'equivalent in {{currency}}',
    markSettled: 'Mark as settled',
    unmarkSettled: 'Unmark settled',
    owes: '{{from}} owes {{to}}',
    expenseAdded: 'Expense added',
    expenseUpdated: 'Expense updated',
    expenseDeleted: 'Expense deleted',
    confirmDelete: 'Are you sure you want to delete this expense?',
    filterAll: 'All',
    filterMine: 'Mine',
    photo: 'Photo',
    addPhoto: 'Add photo',
  },

  // ── Shopping ──
  shopping: {
    title: 'Shopping',
    addItem: 'Add Item',
    editItem: 'Edit Item',
    itemName: 'Item name',
    quantity: 'Quantity',
    price: 'Price',
    note: 'Note',
    assignTo: 'Assign to',
    markBought: 'Mark as bought',
    unmarkBought: 'Unmark',
    categories: {
      groceries: 'Groceries',
      drinks: 'Drinks',
      alcohol: 'Alcohol',
      hygiene: 'Hygiene',
      medicine: 'Medicine',
      other: 'Other',
    },
    items: 'items',
    purchased: 'purchased',
    boughtBy: 'Bought by {{name}}',
  },

  // ── Menu ──
  menu: {
    title: 'Menu Plan',
    addMeal: 'Add Meal',
    editMeal: 'Edit Meal',
    mealDescription: 'Meal description',
    cook: 'Cook',
    lunch: 'Lunch',
    noMealPlanned: 'No meal planned',
  },

  // ── Logbook ──
  logbook: {
    title: 'Logbook',
    addEntry: 'Add Entry',
    editEntry: 'Edit Entry',
    date: 'Date',
    from: 'From',
    to: 'To',
    nauticalMiles: 'Nautical miles',
    departure: 'Departure',
    arrival: 'Arrival',
    skipper: 'Skipper',
    notes: 'Notes',
    totalMiles: 'Total miles',
    entries: 'entries',
    nm: 'NM',
  },

  // ── Cars ──
  cars: {
    title: 'Cars',
    addCar: 'Add Car',
    carName: 'Car name',
    seats: 'Seats',
    driver: 'Driver',
    passengers: 'Passengers',
    addPassenger: 'Add passenger',
    removePassenger: 'Remove',
    unassigned: 'Unassigned crew',
    seatsAvailable: '{{available}} of {{total}} seats available',
  },

  // ── Crews ──
  crews: {
    title: 'Crews',
    members: 'members',
    phone: 'Phone',
    email: 'Email',
  },

  // ── Itinerary ──
  itinerary: {
    title: 'Itinerary',
    day: 'Day {{number}}',
    sailing: 'Sailing',
    port: 'Port',
    car: 'Car',
    other: 'Other',
  },

  // ── Checklist ──
  checklist: {
    title: 'Checklist',
    addItem: 'Add Item',
    categories: {
      required: 'Required',
      clothing: 'Clothing',
      gear: 'Gear',
      recommended: 'Recommended',
    },
  },

  // ── Admin ──
  admin: {
    title: 'Admin Panel',
    settings: 'Settings',
    users: 'Users',
    tripSettings: 'Trip Settings',
    tripName: 'Trip name',
    tripDateFrom: 'Start date',
    tripDateTo: 'End date',
    baseCurrency: 'Base currency',
    language: 'Language',
    passwords: 'Passwords',
    memberPassword: 'Member password',
    adminPassword: 'Admin password',
    addUser: 'Add User',
    editUser: 'Edit User',
    deleteUser: 'Delete User',
    userName: 'Name',
    userPhone: 'Phone',
    userEmail: 'Email',
    userBoat: 'Boat',
    confirmDeleteUser: 'Are you sure you want to delete this user?',
    settingsSaved: 'Settings saved',
    userAdded: 'User added',
    userUpdated: 'User updated',
    userDeleted: 'User deleted',
  },

  // ── Errors ──
  errors: {
    generic: 'Something went wrong',
    notFound: 'Not found',
    unauthorized: 'Unauthorized',
    invalidToken: 'Invalid security token. Please refresh the page.',
    serverError: 'Server error',
  },
};

export default en;

/** Deep type that maps all keys to string values (allows any translation) */
type DeepStringify<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]>;
};

export type Translations = DeepStringify<typeof en>;
