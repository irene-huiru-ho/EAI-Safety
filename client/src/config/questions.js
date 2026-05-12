// ─────────────────────────────────────────────────────────────
// STUDY QUESTIONS CONFIGURATION
// Edit this file to add, remove, or modify questions shown to
// participants after each photo. No other files need to change.
//
// Supported question types:
//   "text"    — open-ended text box
//   "radio"   — single-choice (pick one)
//   "select"  — dropdown
// ─────────────────────────────────────────────────────────────

export const QUESTIONS = [
  {
    id: 'location',
    type: 'radio',
    label: 'Where is this located in the home?',
    required: true,
    options: [
      'Living room',
      'Kitchen',
      'Bedroom',
      'Bathroom',
      'Hallway / stairs',
      'Garage / basement',
      'Outdoor / yard',
      'Other'
    ]
  },
  {
    id: 'hazard_type',
    type: 'radio',
    label: 'What type of physical risk does this represent?',
    required: true,
    options: [
      'Fall / trip hazard',
      'Sharp / cutting edge',
      'Pinch / crush point',
      'Burn / heat hazard',
      'Reach / access difficulty',
      'Slippery surface',
      'Heavy object',
      'Other'
    ]
  },
  {
    id: 'who_affected',
    type: 'radio',
    label: 'Who is most likely to be affected?',
    required: false,
    options: [
      'Myself',
      'Older adult in household',
      'Child in household',
      'Everyone',
      'Visitors / guests'
    ]
  },
  {
    id: 'description',
    type: 'text',
    label: 'Briefly describe the concern you see here.',
    placeholder: 'e.g. "The edge of the cabinet sticks out at head height when the door is open."',
    required: true
  },
  {
    id: 'frequency',
    type: 'radio',
    label: 'How often do you interact with this area or object?',
    required: false,
    options: [
      'Many times a day',
      'Once or twice a day',
      'A few times a week',
      'Rarely'
    ]
  }
];

// Rating scale configuration (1–5)
export const RATINGS = {
  severity: {
    label: 'Physical Safety Severity',
    description: 'How serious could an injury be if something went wrong?',
    low: 'Minor (e.g. small bruise)',
    high: 'Severe (e.g. major injury)'
  },
  significance: {
    label: 'Significance / Concern Level',
    description: 'How concerned are you about this risk overall?',
    low: 'Not very concerned',
    high: 'Extremely concerned'
  }
};
