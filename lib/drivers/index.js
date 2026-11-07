function getDriver(type) {
  switch (type) {
    case 'mysql': return require('./mysql-driver');
    case 'pg': return require('./pg-driver');
    default: throw new Error(`Unsupported driver: ${type}`);
  }
}

module.exports = { getDriver };
