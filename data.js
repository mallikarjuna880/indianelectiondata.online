/*
  DEMO DATA ONLY.
  Before publishing factual election results, replace this file with
  verified data from authoritative sources such as the Election Commission
  of India. Keep the same field names or update app.js accordingly.
*/
const electionData = {
  lokSabha2024: {
    results: [
      {constituency:"Varanasi",state:"Uttar Pradesh",winner:"Narendra Modi",party:"BJP",votes:612970,margin:152513},
      {constituency:"Wayanad",state:"Kerala",winner:"Rahul Gandhi",party:"INC",votes:647445,margin:364422},
      {constituency:"Hyderabad",state:"Telangana",winner:"Asaduddin Owaisi",party:"AIMIM",votes:338087,margin:338087},
      {constituency:"Gandhinagar",state:"Gujarat",winner:"Amit Shah",party:"BJP",votes:744716,margin:744716},
      {constituency:"Lucknow",state:"Uttar Pradesh",winner:"Rajnath Singh",party:"BJP",votes:612709,margin:135159},
      {constituency:"Thiruvananthapuram",state:"Kerala",winner:"Shashi Tharoor",party:"INC",votes:358155,margin:16077},
      {constituency:"Bangalore South",state:"Karnataka",winner:"Tejasvi Surya",party:"BJP",votes:750830,margin:277083},
      {constituency:"Nagpur",state:"Maharashtra",winner:"Nitin Gadkari",party:"BJP",votes:655027,margin:137603}
    ],
    parties: [
      {name:"BJP", seats:240},
      {name:"INC", seats:99},
      {name:"SP", seats:37},
      {name:"AITC", seats:29},
      {name:"DMK", seats:22},
      {name:"TDP", seats:16},
      {name:"JD(U)", seats:12},
      {name:"SHS", seats:9}
    ],
    states: [
      {name:"Uttar Pradesh", seats:80, leading:"BJP / SP"},
      {name:"Maharashtra", seats:48, leading:"BJP / INC / allies"},
      {name:"West Bengal", seats:42, leading:"AITC"},
      {name:"Bihar", seats:40, leading:"BJP / JD(U) / allies"}
    ]
  }
};
