import {
  playerOne,
  playerTwo,
  playerThree,
  playerFour,
  myUser,
  opponentOne,
} from '../../fixtures/userFixtures';
import {
  assertGameState,
  assertSnackbarError,
  assertVictory,
  getCardId,
  assertLoss,
} from '../../support/helpers';
import { Card } from '../../fixtures/cards';
import { SnackBarError } from '../../fixtures/snackbarError';

function setup() {
  cy.wipeDatabase();
  cy.visit('/');
  cy.signupPlayer(myUser);
  cy.vueRoute('/');
}

describe('Spectating Games', () => {
  beforeEach(setup);

  it('Spectates a game', () => {
    cy.setupGameAsSpectator();
    cy.loadGameFixture(0, {
      p0Hand: [Card.ACE_OF_SPADES, Card.ACE_OF_CLUBS],
      p0Points: [Card.TEN_OF_SPADES],
      p0FaceCards: [Card.KING_OF_SPADES],
      p1Hand: [Card.ACE_OF_HEARTS, Card.ACE_OF_DIAMONDS, Card.EIGHT_OF_DIAMONDS],
      p1Points: [Card.TEN_OF_HEARTS],
      p1FaceCards: [Card.KING_OF_HEARTS],
    });

    assertGameState(
      0,
      {
        p0Hand: [Card.ACE_OF_SPADES, Card.ACE_OF_CLUBS],
        p0Points: [Card.TEN_OF_SPADES],
        p0FaceCards: [Card.KING_OF_SPADES],
        p1Hand: [Card.ACE_OF_HEARTS, Card.ACE_OF_DIAMONDS, Card.EIGHT_OF_DIAMONDS],
        p1Points: [Card.TEN_OF_HEARTS],
        p1FaceCards: [Card.KING_OF_HEARTS],
      },
      true,
    );

    // P0 plays ace of spades
    cy.recoverSessionOpponent(playerOne);
    cy.playPointsSpectator(Card.ACE_OF_SPADES, 0);

    assertGameState(
      0,
      {
        p0Hand: [Card.ACE_OF_CLUBS],
        p0Points: [Card.TEN_OF_SPADES, Card.ACE_OF_SPADES],
        p0FaceCards: [Card.KING_OF_SPADES],
        p1Hand: [Card.ACE_OF_HEARTS, Card.ACE_OF_DIAMONDS, Card.EIGHT_OF_DIAMONDS],
        p1Points: [Card.TEN_OF_HEARTS],
        p1FaceCards: [Card.KING_OF_HEARTS],
      },
      true,
    );

    // Refresh the page
    cy.reload();
    // Game state appears unchanged
    assertGameState(
      0,
      {
        p0Hand: [Card.ACE_OF_CLUBS],
        p0Points: [Card.TEN_OF_SPADES, Card.ACE_OF_SPADES],
        p0FaceCards: [Card.KING_OF_SPADES],
        p1Hand: [Card.ACE_OF_HEARTS, Card.ACE_OF_DIAMONDS, Card.EIGHT_OF_DIAMONDS],
        p1Points: [Card.TEN_OF_HEARTS],
        p1FaceCards: [Card.KING_OF_HEARTS],
      },
      true,
    );

    // P1 plays Ace of hearts -- UI updates accordingly
    cy.recoverSessionOpponent(playerTwo);
    cy.playPointsSpectator(Card.ACE_OF_HEARTS, 1);

    assertGameState(
      0,
      {
        p0Hand: [Card.ACE_OF_CLUBS],
        p0Points: [Card.TEN_OF_SPADES, Card.ACE_OF_SPADES],
        p0FaceCards: [Card.KING_OF_SPADES],
        p1Hand: [Card.ACE_OF_DIAMONDS, Card.EIGHT_OF_DIAMONDS],
        p1Points: [Card.TEN_OF_HEARTS, Card.ACE_OF_HEARTS],
        p1FaceCards: [Card.KING_OF_HEARTS],
      },
      true,
    );

    // Disconnect spectator's socket
    cy.window()
      .its('cuttle.authStore')
      .then((store) => store.disconnectSocket());

    // P0 plays ace of clubs
    cy.recoverSessionOpponent(playerOne);
    cy.playPointsSpectator(Card.ACE_OF_CLUBS, 0);

    // Reconnect the socket
    cy.window()
      .its('cuttle.authStore')
      .then((store) => store.reconnectSocket());

    // Spectator receives the update
    assertGameState(
      0,
      {
        p0Hand: [],
        p0Points: [Card.TEN_OF_SPADES, Card.ACE_OF_SPADES, Card.ACE_OF_CLUBS],
        p0FaceCards: [Card.KING_OF_SPADES],
        p1Hand: [Card.ACE_OF_DIAMONDS, Card.EIGHT_OF_DIAMONDS],
        p1Points: [Card.TEN_OF_HEARTS, Card.ACE_OF_HEARTS],
        p1FaceCards: [Card.KING_OF_HEARTS],
      },
      true,
    );

    // P1 plays the Eight of Diamonds and wins
    cy.recoverSessionOpponent(playerTwo);
    cy.playPointsSpectator(Card.EIGHT_OF_DIAMONDS, 1);

    assertLoss();
    cy.get('[data-cy=gameover-go-home]').click();
    cy.url().should('not.include', '/game');
  });

  it('Correctly shows and hides dialogs and overlays', () => {
    cy.setupGameAsSpectator();
    cy.loadGameFixture(0, {
      p0Hand: [Card.ACE_OF_SPADES, Card.THREE_OF_CLUBS],
      p0Points: [],
      p0FaceCards: [],
      p1Hand: [Card.FOUR_OF_CLUBS, Card.ACE_OF_DIAMONDS],
      p1Points: [Card.ACE_OF_CLUBS],
      p1FaceCards: [Card.KING_OF_HEARTS],
    });

    cy.recoverSessionOpponent(playerOne);
    cy.playOneOffSpectator(Card.ACE_OF_SPADES, 0);
    cy.get('#waiting-for-opponent-counter-scrim').should('be.visible');

    cy.recoverSessionOpponent(playerTwo);
    cy.resolveOpponent();
    cy.get('#waiting-for-opponent-counter-scrim').should('not.exist');

    cy.playOneOffSpectator(Card.ACE_OF_DIAMONDS, 1);
    cy.get('#cannot-counter-dialog').should('be.visible');
    cy.recoverSessionOpponent(playerOne);
    cy.resolveOpponent();

    cy.get('.v-overlay').should('not.exist');
  });

  it('Leaves a spectated game and joins another without processing extraneous updates', () => {
    cy.setupGameAsSpectator();
    cy.loadGameFixture(0, {
      p0Hand: [Card.ACE_OF_SPADES],
      p0Points: [],
      p0FaceCards: [],
      p1Hand: [Card.FOUR_OF_CLUBS, Card.ACE_OF_DIAMONDS],
      p1Points: [Card.ACE_OF_CLUBS],
      p1FaceCards: [Card.KING_OF_HEARTS],
    });

    cy.window()
      .its('cuttle.gameStore')
      .then((game) => {
        const aceOfSpadesId = getCardId(game, Card.ACE_OF_SPADES);
        cy.wrap(aceOfSpadesId).as('aceOfSpades');
      });

    cy.vueRoute('/');
    cy.signupOpponent(opponentOne);
    cy.setupGameAsP0(true);
    cy.loadGameFixture(0, {
      p0Hand: [Card.TWO_OF_CLUBS, Card.TWO_OF_DIAMONDS],
      p0Points: [],
      p0FaceCards: [],
      p1Hand: [Card.TWO_OF_HEARTS, Card.TWO_OF_SPADES],
      p1Points: [],
      p1FaceCards: [],
    });

    cy.recoverSessionOpponent(playerOne);
    cy.get('@aceOfSpades').then((aceOfSpadesId) => {
      cy.playPointsById(aceOfSpadesId);
    });

    cy.wait(3000);

    assertGameState(0, {
      p0Hand: [Card.TWO_OF_CLUBS, Card.TWO_OF_DIAMONDS],
      p0Points: [],
      p0FaceCards: [],
      p1Hand: [Card.TWO_OF_HEARTS, Card.TWO_OF_SPADES],
      p1Points: [],
      p1FaceCards: [],
    });
  });

  it('Prevents spectator from making moves', () => {
    cy.setupGameAsSpectator();
    cy.loadGameFixture(0, {
      p0Hand: [
        Card.ACE_OF_SPADES,
        Card.ACE_OF_HEARTS,
        Card.TWO_OF_DIAMONDS,
        Card.KING_OF_CLUBS,
        Card.JACK_OF_DIAMONDS,
        Card.THREE_OF_CLUBS,
      ],
      p0Points: [],
      p0FaceCards: [],
      p1Hand: [Card.FOUR_OF_CLUBS, Card.ACE_OF_DIAMONDS],
      p1Points: [Card.ACE_OF_CLUBS],
      p1FaceCards: [Card.KING_OF_HEARTS],
    });

    assertGameState(
      0,
      {
        p0Hand: [
          Card.ACE_OF_SPADES,
          Card.ACE_OF_HEARTS,
          Card.TWO_OF_DIAMONDS,
          Card.THREE_OF_CLUBS,
          Card.JACK_OF_DIAMONDS,
          Card.KING_OF_CLUBS,
        ],
        p0Points: [],
        p0FaceCards: [],
        p1Hand: [Card.FOUR_OF_CLUBS, Card.ACE_OF_DIAMONDS],
        p1Points: [Card.ACE_OF_CLUBS],
        p1FaceCards: [Card.KING_OF_HEARTS],
      },
      true,
    );

    // Can't draw
    cy.get('#deck').click();
    assertSnackbarError(SnackBarError.NOT_IN_GAME);
    cy.log('Correctly prevented from drawing from deck');

    // Can't play points
    cy.get('[data-player-hand-card=1-3]').click();
    cy.get('[data-move-choice=points]').click();
    assertSnackbarError(SnackBarError.NOT_IN_GAME);
    cy.log('Correctly prevented from playing points');

    // Can't scuttle
    cy.get('[data-player-hand-card=1-3]').click();
    cy.get('[data-move-choice=scuttle]').click();
    cy.get('[data-opponent-point-card=1-0]').click();
    assertSnackbarError(SnackBarError.NOT_IN_GAME);
    cy.log('Correctly prevented from scuttling');

    // Can't play royal
    cy.get('[data-player-hand-card=13-0]').click();
    cy.get('[data-move-choice=faceCard]').click();
    assertSnackbarError(SnackBarError.NOT_IN_GAME);
    cy.log('Correctly prevented from playing royal');

    // Can't play jack
    cy.get('[data-player-hand-card=11-1]').click();
    cy.get('[data-move-choice=jack]').click();
    cy.get('[data-opponent-point-card=1-0]').click();
    assertSnackbarError(SnackBarError.NOT_IN_GAME);
    cy.log('Correctly prevented from playing jack');

    // Can't play oneOff
    cy.get('[data-player-hand-card=1-3]').click();
    cy.get('[data-move-choice=oneOff]').click();
    assertSnackbarError(SnackBarError.NOT_IN_GAME);
    cy.log('Correctly prevented from untargeted one-off');

    // Can't play targeted oneOff
    cy.get('[data-player-hand-card=2-1]').click();
    cy.get('[data-move-choice=targetedOneOff]').click();
    cy.get('[data-opponent-face-card=13-2]').click();
    assertSnackbarError(SnackBarError.NOT_IN_GAME);
    cy.log('Correctly prevented from targeted one-off');

    // Can't resolve three
    // Can't resolve four
    // Can't resolve seven
    // Can't counter
    // Can't resolve
  });

  describe('Spectators Layout', () => {
    it('Display list of spectators and adds to list when new spectator joins', () => {
      cy.setupGameAsSpectator();
      cy.vueRoute('/');
      // Player 3 spectates player1 vs player2
      cy.signupOpponent(playerThree);
      cy.get('@gameData').then((gameData) => {
        cy.setOpponentToSpectate(gameData.gameId);
      });
      // My user begins spectating, sees player3 in spectator list
      cy.get('[data-cy-game-list-selector=spectate]').click();
      cy.get(`[data-cy-spectate-game]`).click();
      cy.get('[data-cy="spectate-list-button"]').should('contain', '2').click();
      cy.get('[data-cy="spectate-list-menu"')
        .should('contain', 'myUsername')
        .should('contain', playerThree.username);
      // Player 4 begins spectating
      cy.get('@gameData').then((gameData) => {
        cy.signupOpponent(playerFour);
        cy.setOpponentToSpectate(gameData.gameId);
      });
      // Player 4 now appears in spectator list
      cy.get('[data-cy="spectate-list-button"]').should('contain', '3').click();
      cy.get('[data-cy="spectate-list-menu"')
        .should('contain', 'myUsername')
        .should('contain', playerThree.username)
        .should('contain', playerFour.username);
    });

    it('Should display no spectators', () => {
      cy.setupGameAsP0();
      cy.get('[data-cy="spectate-list-button"]').should('contain', '0').click();
      cy.get('[data-cy="spectate-list-menu"]').should('contain', 'Currently no spectators');
    });

    it('Should remove spectators from list after leaving', () => {
      cy.setupGameAsSpectator();
      cy.signupOpponent(playerThree);
      cy.get('@gameData').then((gameData) => {
        cy.setOpponentToSpectate(gameData.gameId);
      });
      cy.get('[data-cy="spectate-list-button"]').should('contain', '2').click();
      cy.get('[data-cy="spectate-list-menu"')
        .should('contain', 'myUsername')
        .should('contain', playerThree.username);
      cy.setOpponentToLeaveSpectate();
      cy.get('[data-cy="spectate-list-menu"').should('not.contain', playerThree.username);
    });

    it('Should show correct menu options, leave game, then return to re-add name to list', () => {
      cy.setupGameAsSpectator();
      cy.get('#game-menu-activator').click();
      cy.get('#game-menu')
        .should('contain', 'Go Home')
        .should('contain', 'Rules')
        .should('not.contain', 'Request Stalemate')
        .should('not.contain', 'Concede');
      cy.get('[data-cy="stop-spectating"]').click();
      cy.hash().should('eq', '#/');
      cy.get('[data-cy-game-list-selector=spectate]').click();
      cy.get(`[data-cy-spectate-game]`).click();
      cy.get('[data-cy="spectate-list-button"]').should('contain', '1').click();
      cy.get('[data-cy="spectate-list-menu"').should('contain', 'myUsername');
    });
  });
});

describe('Creating And Updating Unranked Matches With Rematch - Spectating', () => {
  beforeEach(function () {
    cy.wipeDatabase();
    cy.visit('/');

    // Sign up players
    cy.signupOpponent(playerOne).as('playerOneId');
    cy.signupOpponent(playerThree).as('playerThreeId'); // spectator
    // Opponent will be player 2 (the last one we log in as)
    cy.signupOpponent(playerTwo).as('playerTwoId');

    // Log in as playerOne
    cy.loginPlayer(playerOne);
    cy.setupGameAsSpectator();
  });

  it('Spectate unranked games with rematch', function () {
    // 1st game: Opponent concedes
    cy.recoverSessionOpponent(playerTwo);
    cy.concedeOpponent();
    assertVictory();
    cy.log('rematch player2');

    cy.window()
      .its('cuttle.gameStore')
      .then((game) => {
        cy.rematchOpponent({ gameId: game.id, rematch: true });
      });

    cy.get('[data-cy="opponent-wants-rematch"]').should('be.visible');

    cy.window()
      .its('cuttle.gameStore')
      .then((game) => {
        cy.expect(game.p0Rematch).to.be.null;
        cy.expect(game.p1Rematch).to.be.true;
      });

    cy.recoverSessionOpponent(playerOne);

    cy.wait(1000);

    cy.window()
      .its('cuttle.gameStore')
      .then((game) => {
        cy.rematchOpponent({ gameId: game.id, rematch: true });
      });
    cy.wait(1000);

    cy.window()
      .its('cuttle.gameStore')
      .then((game) => {
        // new game, so rematch is null
        cy.expect(game.p0Rematch).to.be.null;
        cy.expect(game.p1Rematch).to.be.null;
      });

    cy.log('join rematch player 1');

    cy.url().then((url) => {
      const oldGameId = url.split('/').pop();
      cy.joinRematchOpponent({ oldGameId });

      cy.log('recover player 2');
      cy.recoverSessionOpponent(playerTwo);
      cy.log('join rematch player 2');
      cy.joinRematchOpponent({ oldGameId });
    });

    cy.signupOpponent(playerThree);

    cy.window()
      .its('cuttle.gameStore')
      .then((game) => {
        cy.url({ timeout: 10000 }).should('include', `/spectate/${game.id}`);
        cy.setOpponentToSpectate(game.id);
      });

    cy.get('[data-cy="spectate-list-button"]').should('contain', '2').click();
    cy.get('[data-cy="spectate-list-menu"')
      .should('contain', 'myUsername')
      .should('contain', playerThree.username);
  });
});
