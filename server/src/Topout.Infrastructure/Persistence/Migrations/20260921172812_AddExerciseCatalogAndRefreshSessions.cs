using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Topout.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddExerciseCatalogAndRefreshSessions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(name: "IX_Exercises_UserId_Name", table: "Exercises");

            migrationBuilder.DropIndex(name: "EmailIndex", table: "AspNetUsers");

            migrationBuilder.AddColumn<bool>(
                name: "IsCustom",
                table: "Exercises",
                type: "boolean",
                nullable: false,
                defaultValue: false
            );

            migrationBuilder.AddColumn<string>(
                name: "NormalizedName",
                table: "Exercises",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: ""
            );

            // Existing exercises predate the starter catalog and are custom.
            // Duplicate normalized names deliberately fail the unique index below,
            // leaving this transactional migration unapplied rather than deleting user data.
            migrationBuilder.Sql(
                """
                UPDATE "Exercises"
                SET "NormalizedName" = upper(btrim("Name")), "IsCustom" = TRUE;
                """
            );

            migrationBuilder.AlterColumn<string>(
                name: "DisplayName",
                table: "AspNetUsers",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text"
            );

            migrationBuilder.CreateTable(
                name: "RefreshSessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(
                        type: "timestamp with time zone",
                        nullable: false
                    ),
                    ExpiresAt = table.Column<DateTime>(
                        type: "timestamp with time zone",
                        nullable: false
                    ),
                    RevokedAt = table.Column<DateTime>(
                        type: "timestamp with time zone",
                        nullable: true
                    ),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RefreshSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RefreshSessions_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade
                    );
                }
            );

            migrationBuilder.CreateTable(
                name: "RefreshTokens",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    TokenHash = table.Column<string>(
                        type: "character varying(64)",
                        maxLength: 64,
                        nullable: false
                    ),
                    CreatedAt = table.Column<DateTime>(
                        type: "timestamp with time zone",
                        nullable: false
                    ),
                    ExpiresAt = table.Column<DateTime>(
                        type: "timestamp with time zone",
                        nullable: false
                    ),
                    RevokedAt = table.Column<DateTime>(
                        type: "timestamp with time zone",
                        nullable: true
                    ),
                    ReplacedById = table.Column<Guid>(type: "uuid", nullable: true),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RefreshTokens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RefreshTokens_RefreshSessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "RefreshSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade
                    );
                    table.ForeignKey(
                        name: "FK_RefreshTokens_RefreshTokens_ReplacedById",
                        column: x => x.ReplacedById,
                        principalTable: "RefreshTokens",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict
                    );
                }
            );

            migrationBuilder.CreateIndex(
                name: "IX_Exercises_UserId_NormalizedName",
                table: "Exercises",
                columns: new[] { "UserId", "NormalizedName" },
                unique: true
            );

            migrationBuilder.CreateIndex(
                name: "EmailIndex",
                table: "AspNetUsers",
                column: "NormalizedEmail",
                unique: true
            );

            migrationBuilder.CreateIndex(
                name: "IX_RefreshSessions_ExpiresAt",
                table: "RefreshSessions",
                column: "ExpiresAt"
            );

            migrationBuilder.CreateIndex(
                name: "IX_RefreshSessions_UserId",
                table: "RefreshSessions",
                column: "UserId"
            );

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_ReplacedById",
                table: "RefreshTokens",
                column: "ReplacedById"
            );

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_SessionId",
                table: "RefreshTokens",
                column: "SessionId"
            );

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_TokenHash",
                table: "RefreshTokens",
                column: "TokenHash",
                unique: true
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "RefreshTokens");

            migrationBuilder.DropTable(name: "RefreshSessions");

            migrationBuilder.DropIndex(
                name: "IX_Exercises_UserId_NormalizedName",
                table: "Exercises"
            );

            migrationBuilder.DropIndex(name: "EmailIndex", table: "AspNetUsers");

            migrationBuilder.DropColumn(name: "IsCustom", table: "Exercises");

            migrationBuilder.DropColumn(name: "NormalizedName", table: "Exercises");

            migrationBuilder.AlterColumn<string>(
                name: "DisplayName",
                table: "AspNetUsers",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100
            );

            migrationBuilder.CreateIndex(
                name: "IX_Exercises_UserId_Name",
                table: "Exercises",
                columns: new[] { "UserId", "Name" },
                unique: true
            );

            migrationBuilder.CreateIndex(
                name: "EmailIndex",
                table: "AspNetUsers",
                column: "NormalizedEmail"
            );
        }
    }
}
