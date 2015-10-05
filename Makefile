REPORTER ?= spec
TESTS = ./tests/*.test.js
NPM_BIN = ./node_modules/.bin

jshint:
	$(NPM_BIN)/jshint lib tests

fixjsstyle:
	fixjsstyle -r lib -r test --strict --jslint_error=all

coverage: jshint
	$(NPM_BIN)/istanbul cover $(NPM_BIN)/_mocha --report lcovonly -- --recursive -t 10000 --ui tdd $(TESTS)

test: jshint
	$(NPM_BIN)/mocha --globals setImmediate,clearImmediate --check-leaks --colors -t 10000 --reporter $(REPORTER) $(TESTS)

.PHONY: jshint fixjsstyle coverage test
