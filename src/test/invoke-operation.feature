
Feature: Invoke Operation

    So that I can perform actions on a resource
    As a developer
    I want to be able to invoke operations

    Scenario: Invoke operation - self
        Given a resource with a "self" operation that returns itself
        When waychaser successfully loads that resource
        And we successfully invoke the "self" operation
        Then the same resource will be returned

    Scenario: Invoke operation error
        Given a resource with a "error" operation that returns an error
        When waychaser successfully loads that resource
        And we invoke the "error" operation
        Then it will NOT have loaded successfully

    Scenario: Invoke operation - next
        Given a resource returning status code 200
        And a resource with a "next" operation that returns that resource
        When waychaser successfully loads the latter resource
        And we successfully invoke the "next" operation
        Then the former resource will be returned

    Scenario: Invoke operation - list
        Given a list of 4 resources linked with "next" operations
        When waychaser successfully loads the first resource in the list
        And invokes each of the "next" operations in turn 3 times
        Then the last resource returned will be the last item in the list

    Scenario: Invoke operation - parameterised
        Given a resource with a "https://waychaser.io/rel/pong" operation that returns the provided "ping" parameter
        When waychaser successfully loads that resource
        And we invoke the "https://waychaser.io/rel/pong" operation with the input
            | ping | pong |
        Then resource returned will contain those values

    Scenario: Invoke operation - parameterised with extra params
        Given a resource with a "https://waychaser.io/rel/pong" operation that returns the provided "ping" parameter
        When waychaser successfully loads that resource
        And we invoke the "https://waychaser.io/rel/pong" operation with the input
            | ping  | pong    |
            | other | notUsed |
        Then resource returned will contain only
            | ping | pong |

    Scenario Outline: Invoke operation - methods
        Given a resource with a "https://waychaser.io/rel/do-it" operation with the "<METHOD>" method returning status code <CODE>
        When waychaser successfully loads that resource
        And we invoke the "https://waychaser.io/rel/do-it" operation
        Then resource returned will have the status code <CODE>

        Examples:
            | METHOD | CODE |
            | DELETE | 204  |
            | POST   | 201  |
            | PUT    | 204  |
            | PATCH  | 204  |


    Scenario Outline: Invoke operation - methods parameterised
        Given a resource with a "https://waychaser.io/rel/pong" operation with the "<METHOD>" method that returns the provided "ping" parameter
        When waychaser successfully loads that resource
        And we invoke the "https://waychaser.io/rel/pong" operation with the input
            | ping | pong |
        Then resource returned will contain those values

        Examples:
            | METHOD |
            | DELETE |
            | POST   |
            | PUT    |
            | PATCH  |

    Scenario Outline: Invoke operation - methods parameterised with extra params
        Given a resource with a "https://waychaser.io/rel/pong" operation with the "<METHOD>" method that returns the provided "ping" parameter
        When waychaser successfully loads that resource
        And we invoke the "https://waychaser.io/rel/pong" operation with the input
            | ping  | pong    |
            | other | notUsed |
        Then resource returned will contain only
            | ping | pong |

        Examples:
            | METHOD |
            | DELETE |
            | POST   |
            | PUT    |
            | PATCH  |