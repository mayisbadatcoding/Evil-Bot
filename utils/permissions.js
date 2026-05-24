const POINT_MANAGER_ROLES = [
    "1507960823023407286",
    "1507960993937096826",
    "1508189587023990894"
];

function canManagePoints(member) {
    return member.roles.cache.some(role => POINT_MANAGER_ROLES.includes(role.id));
}

module.exports = {
    canManagePoints
};