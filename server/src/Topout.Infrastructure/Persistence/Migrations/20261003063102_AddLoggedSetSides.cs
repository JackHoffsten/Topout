using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Topout.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLoggedSetSides : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_WorkoutLogSets_WorkoutLogEntryId_Order",
                table: "WorkoutLogSets"
            );

            migrationBuilder.AddColumn<int>(
                name: "Side",
                table: "WorkoutLogSets",
                type: "integer",
                nullable: false,
                defaultValue: 0
            );

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutLogSets_WorkoutLogEntryId_Order_Side",
                table: "WorkoutLogSets",
                columns: new[] { "WorkoutLogEntryId", "Order", "Side" },
                unique: true
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DO $$ BEGIN
                  IF EXISTS (SELECT 1 FROM "WorkoutLogSets" WHERE "Side" <> 0) THEN
                    RAISE EXCEPTION 'Cannot downgrade while left/right set results exist.';
                  END IF;
                END $$;
                """
            );
            migrationBuilder.DropIndex(
                name: "IX_WorkoutLogSets_WorkoutLogEntryId_Order_Side",
                table: "WorkoutLogSets"
            );

            migrationBuilder.DropColumn(name: "Side", table: "WorkoutLogSets");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutLogSets_WorkoutLogEntryId_Order",
                table: "WorkoutLogSets",
                columns: new[] { "WorkoutLogEntryId", "Order" },
                unique: true
            );
        }
    }
}
