export interface School {
    id: string;
    name: string;
    shortName: string;
    code: string;
}

export const SCHOOLS: School[] = [
    {
        id: 'auca',
        name: 'Adventist University of Central Africa',
        shortName: 'AUCA',
        code: 'AUCA'
    },
    {
        id: 'ulk',
        name: 'Kigali Independent University',
        shortName: 'ULK',
        code: 'ULK'
    },
    {
        id: 'uok',
        name: 'University of Kigali',
        shortName: 'UoK',
        code: 'UOK'
    },
    {
        id: 'kcu',
        name: 'Kigali Christian University',
        shortName: 'KCU',
        code: 'KCU'
    },
    {
        id: 'rica',
        name: 'Rwanda Institute for Conservation Agriculture',
        shortName: 'RICA',
        code: 'RICA'
    },
    {
        id: 'ick',
        name: 'Institut Catholique de Kabgayi',
        shortName: 'ICK',
        code: 'ICK'
    },
    {
        id: 'cur',
        name: 'Catholic University of Rwanda',
        shortName: 'CUR',
        code: 'CUR'
    },
    {
        id: 'mku',
        name: 'Mount Kenya University Rwanda',
        shortName: 'MKU Rwanda',
        code: 'MKU'
    },
    {
        id: 'kepler',
        name: 'Kepler University (in partnership with SNHU)',
        shortName: 'Kepler',
        code: 'KEPLER'
    },
    {
        id: 'eaur',
        name: 'East African University Rwanda',
        shortName: 'EAUR',
        code: 'EAUR'
    },
    {
        id: 'utb',
        name: 'University of Tourism, Technology and Business Studies',
        shortName: 'UTB',
        code: 'UTB'
    },
    {
        id:'ines',
        name:'INES',
        shortName:'INES',
        code:'INES'
    },
    {
        id: 'akilah',
        name: 'Akilah Institute (now part of Davis College)',
        shortName: 'Akilah',
        code: 'AKILAH'
    },
    {
        id: 'mipc',
        name: 'Muhabura Integrated Polytechnic College',
        shortName: 'MIPC',
        code: 'MIPC'
    },
    {
        id: 'kp',
        name: 'Kibogora Polytechnic',
        shortName: 'KP',
        code: 'KP'
    },
    
];

export const getSchoolById = (id: string): School | undefined => {
    return SCHOOLS.find(school => school.id === id);
};

export const getSchoolByCode = (code: string): School | undefined => {
    return SCHOOLS.find(school => school.code === code);
}; 