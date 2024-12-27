const roles = {
    ADMIN: 'admin',
    USER: 'user',
};

const rolePermissions = {
    [roles.ADMIN]: ['readAny', 'writeAny'],
    [roles.USER]: ['readOwn'],
};

module.exports = {
    roles,
    rolePermissions,
};
