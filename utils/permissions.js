const FULL_COMMAND_ACCESS_ROLES = [
    "1509010872599711764",
    "1507960920180265114",
    "1507960993937096826",
    "1507960823023407286",
    
];


const POINT_MANAGER_ROLES = [
    "1507960823023407286",
    "1507960993937096826",
    "1508189587023990894"
];

const PRE_RELEASE_ROLES = [
    "1515872052475596800",
    "1509010872599711764",
    "1507960920180265114"
];

function canUsePreRelease(member) {
    return member.roles.cache.some(role =>
        PRE_RELEASE_ROLES.includes(role.id)
    );
}

function hasFullCommandAccess(member) {
    return member.roles.cache.some(role =>
        FULL_COMMAND_ACCESS_ROLES.includes(role.id)
    );
}

function canManagePoints(member) {
    return (
        hasFullCommandAccess(member) ||
        member.roles.cache.some(role => POINT_MANAGER_ROLES.includes(role.id))
    );
}

module.exports = {
    hasFullCommandAccess,
    canManagePoints,
    canUsePreRelease,
    FULL_COMMAND_ACCESS_ROLES
};